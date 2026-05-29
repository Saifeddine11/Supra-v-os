import 'server-only';

import type { AuthContext } from '@/lib/auth/permissions';
import { assertClientRecordVisible, taskListingDenied } from '@/lib/auth/data-scope';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isTaskDueTodayForAlert,
  isTaskOverdueForAlert,
  isTaskActiveForCriticalAlerts,
} from '@/lib/alerts/active-alert-rules';
import { fetchCriticalAlertsWithClient } from '@/lib/data/critical-alerts';
import { listClients, getClientById } from '@/lib/data/clients';
import { listTasksEnriched } from '@/lib/data/tasks';
import { listVideosWithClients } from '@/lib/data/videos';
import { hrefTasksOpenDetail } from '@/lib/tasks/task-deep-link';
import { hrefVideosOpenDetailKanban } from '@/lib/videos/video-deep-link';
import { videoStaffProductionStatusLabel } from '@/lib/videos/video-staff-status';
import { effectiveClientDeliveryIso } from '@/lib/videos/video-schedule';
import { isTodayCalendar } from '@/lib/deadlines/deadline-state';
import { TASK_STATUS_MAP, PRIORITY_MAP, CLIENT_STATUS_MAP } from '@/types/domain';
import type { TaskEnriched } from '@/types/database';
import type { VideoWithClient } from '@/lib/data/videos';
import type {
  AiClientContextItem,
  AiClientSummaryPayload,
  AiContextLink,
  AiContextRequest,
  AiContextToolResult,
  AiTaskContextItem,
  AiTodayPrioritiesPayload,
  AiVideoContextItem,
} from '@/lib/ai/context-schema';
import { AI_CONTEXT_LIMITS } from '@/lib/ai/context-schema';
import { parseUuidParam } from '@/lib/security/input-validation';

function trimText(value: string | null | undefined, max: number = AI_CONTEXT_LIMITS.descriptionMax): string | null {
  if (!value?.trim()) return null;
  const t = value.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function taskStatusLabel(status: string): string {
  return TASK_STATUS_MAP[status as keyof typeof TASK_STATUS_MAP]?.label ?? status;
}

function priorityLabel(priority: string): string {
  return PRIORITY_MAP[priority as keyof typeof PRIORITY_MAP]?.label ?? priority;
}

function clientStatusLabel(status: string): string {
  return CLIENT_STATUS_MAP[status as keyof typeof CLIENT_STATUS_MAP]?.label ?? status;
}

function mapTask(t: TaskEnriched): AiTaskContextItem {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    statusLabel: taskStatusLabel(t.status),
    priority: t.priority,
    priorityLabel: priorityLabel(t.priority),
    deadline: t.deadline,
    clientName: t.client_name,
    assigneeNames: t.assignee_name,
    description: trimText(t.description),
    href: hrefTasksOpenDetail(t.id),
  };
}

function mapVideo(v: VideoWithClient): AiVideoContextItem {
  const team = [v.editor_name, v.cameraman_name].filter(Boolean).join(' · ') || null;
  const delivery = effectiveClientDeliveryIso(v);
  return {
    id: v.id,
    title: v.title,
    clientName: v.clients?.name ?? null,
    productionStatus: videoStaffProductionStatusLabel(v.status),
    shootingDate: v.shooting_date,
    deliveryDate: delivery,
    teamNames: team,
    href: hrefVideosOpenDetailKanban(v.id),
  };
}

function taskLinks(tasks: AiTaskContextItem[]): AiContextLink[] {
  return tasks.map((t) => ({ label: t.title, href: t.href, kind: 'task' as const }));
}

function videoLinks(videos: AiVideoContextItem[]): AiContextLink[] {
  return videos.map((v) => ({ label: v.title, href: v.href, kind: 'video' as const }));
}

async function loadAccountManagerNames(
  sb: Awaited<ReturnType<typeof createClient>>,
  managerIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(managerIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data } = await sb.from('employees').select('id, full_name').in('id', ids);
  return new Map((data ?? []).map((r) => [r.id as string, String(r.full_name)]));
}

async function mapClientRow(
  c: Awaited<ReturnType<typeof listClients>>[number],
  managerMap: Map<string, string>,
): Promise<AiClientContextItem> {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    statusLabel: clientStatusLabel(c.status),
    accountManager: c.account_manager_id ? managerMap.get(c.account_manager_id) ?? null : null,
    sector: c.sector ?? null,
    city: c.city ?? null,
    activitySummary: c.services?.length ? `${c.services.length} service(s) actif(s)` : null,
    href: `/clients/${c.id}`,
  };
}

async function searchTasks(ctx: AuthContext, query?: string, overdueOnly?: boolean): Promise<AiContextToolResult> {
  if (taskListingDenied(ctx)) {
    return { ok: false, denied: true, reason: 'Votre rôle ne permet pas de consulter les tâches.' };
  }

  const enriched = await listTasksEnriched({ search: query }, ctx);
  const now = new Date();
  const q = query?.toLowerCase().trim();

  let filtered = enriched.filter((t) => isTaskActiveForCriticalAlerts(t));

  if (overdueOnly) {
    filtered = filtered.filter((t) => isTaskOverdueForAlert({ status: t.status, deadline: t.deadline, now }));
  }

  if (q) {
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.client_name?.toLowerCase().includes(q) ?? false) ||
        (t.assignee_name?.toLowerCase().includes(q) ?? false) ||
        (t.description?.toLowerCase().includes(q) ?? false),
    );
  }

  filtered.sort((a, b) => {
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return da - db;
  });

  const truncated = filtered.length > AI_CONTEXT_LIMITS.tasks;
  const tasks = filtered.slice(0, AI_CONTEXT_LIMITS.tasks).map(mapTask);

  return {
    ok: true,
    tool: 'searchTasks',
    empty: tasks.length === 0,
    truncated,
    payload: { tasks },
    links: taskLinks(tasks),
  };
}

async function searchClients(ctx: AuthContext, query?: string): Promise<AiContextToolResult> {
  const sb = await createClient();
  const rows = await listClients({ search: query }, ctx);
  const truncated = rows.length > AI_CONTEXT_LIMITS.clients;
  const slice = rows.slice(0, AI_CONTEXT_LIMITS.clients);
  const managerMap = await loadAccountManagerNames(
    sb,
    slice.map((c) => c.account_manager_id).filter(Boolean) as string[],
  );
  const clients = await Promise.all(slice.map((c) => mapClientRow(c, managerMap)));

  return {
    ok: true,
    tool: 'searchClients',
    empty: clients.length === 0,
    truncated,
    payload: { clients },
    links: clients.map((c) => ({ label: c.name, href: c.href, kind: 'client' as const })),
  };
}

async function searchVideos(ctx: AuthContext, query?: string): Promise<AiContextToolResult> {
  const videos = await listVideosWithClients(ctx);
  const q = query?.toLowerCase().trim();

  let filtered = videos.filter((v) => v.status !== 'archived' && v.status !== 'cancelled');
  if (q) {
    filtered = filtered.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.clients?.name?.toLowerCase().includes(q) ?? false) ||
        (v.editor_name?.toLowerCase().includes(q) ?? false) ||
        (v.cameraman_name?.toLowerCase().includes(q) ?? false),
    );
  }

  const truncated = filtered.length > AI_CONTEXT_LIMITS.videos;
  const mapped = filtered.slice(0, AI_CONTEXT_LIMITS.videos).map(mapVideo);

  return {
    ok: true,
    tool: 'searchVideos',
    empty: mapped.length === 0,
    truncated,
    payload: { videos: mapped },
    links: videoLinks(mapped),
  };
}

async function getTodayPriorities(ctx: AuthContext): Promise<AiContextToolResult> {
  const now = new Date();
  const bundle = await fetchCriticalAlertsWithClient(createAdminClient(), ctx);
  const needingAttention = bundle.allActionItems.slice(0, AI_CONTEXT_LIMITS.tasks).map((a) => {
    const kind = a.href.includes('/tasks') ? ('task' as const) : ('video' as const);
    return {
      kind,
      label: a.typeLabel,
      title: a.title,
      detail: a.detail,
      href: a.href,
    };
  });

  let overdueTasks: AiTaskContextItem[] = [];
  let dueTodayTasks: AiTaskContextItem[] = [];
  let shootingsToday: AiVideoContextItem[] = [];
  let deliveriesToday: AiVideoContextItem[] = [];

  if (!taskListingDenied(ctx)) {
    const tasks = await listTasksEnriched({}, ctx);
    overdueTasks = tasks
      .filter((t) => isTaskOverdueForAlert({ status: t.status, deadline: t.deadline, now }))
      .slice(0, AI_CONTEXT_LIMITS.tasks)
      .map(mapTask);
    dueTodayTasks = tasks
      .filter((t) => isTaskDueTodayForAlert({ status: t.status, deadline: t.deadline, now }))
      .slice(0, AI_CONTEXT_LIMITS.tasks)
      .map(mapTask);
  }

  const videos = await listVideosWithClients(ctx);
  shootingsToday = videos
    .filter((v) => v.shooting_date && isTodayCalendar(v.shooting_date, now))
    .slice(0, AI_CONTEXT_LIMITS.videos)
    .map(mapVideo);
  deliveriesToday = videos
    .filter((v) => {
      const del = effectiveClientDeliveryIso(v);
      return del && isTodayCalendar(del, now);
    })
    .slice(0, AI_CONTEXT_LIMITS.videos)
    .map(mapVideo);

  const priorities: AiTodayPrioritiesPayload = {
    scopeHint: bundle.scopeHint,
    overdueTasks,
    dueTodayTasks,
    shootingsToday,
    deliveriesToday,
    needingAttention,
  };

  const links: AiContextLink[] = [
    ...taskLinks(overdueTasks),
    ...taskLinks(dueTodayTasks),
    ...videoLinks(shootingsToday),
    ...videoLinks(deliveriesToday),
    ...needingAttention.map((n) => ({
      label: n.title,
      href: n.href,
      kind: n.kind,
    })),
  ].slice(0, 12);

  const empty =
    overdueTasks.length === 0 &&
    dueTodayTasks.length === 0 &&
    shootingsToday.length === 0 &&
    deliveriesToday.length === 0 &&
    needingAttention.length === 0;

  return {
    ok: true,
    tool: 'getTodayPriorities',
    empty,
    truncated: bundle.allActionItems.length > AI_CONTEXT_LIMITS.tasks,
    payload: { priorities },
    links,
  };
}

async function resolveClientForSummary(
  ctx: AuthContext,
  query?: string,
  clientId?: string,
): Promise<AiClientContextItem | null> {
  const sb = await createClient();
  if (clientId && parseUuidParam(clientId)) {
    const c = await getClientById(clientId, ctx);
    if (!c) return null;
    const managerMap = await loadAccountManagerNames(
      sb,
      c.account_manager_id ? [c.account_manager_id] : [],
    );
    return mapClientRow(c, managerMap);
  }

  const q = query?.trim();
  if (!q) return null;
  const matches = await listClients({ search: q }, ctx);
  if (matches.length === 0) return null;
  const managerMap = await loadAccountManagerNames(
    sb,
    matches[0].account_manager_id ? [matches[0].account_manager_id] : [],
  );
  return mapClientRow(matches[0], managerMap);
}

async function getClientSummary(
  ctx: AuthContext,
  query?: string,
  clientId?: string,
): Promise<AiContextToolResult> {
  const client = await resolveClientForSummary(ctx, query, clientId);
  if (!client) {
    return {
      ok: true,
      tool: 'getClientSummary',
      empty: true,
      truncated: false,
      payload: {
        summary: {
          client: {
            id: '',
            name: query ?? '—',
            status: '',
            statusLabel: '',
            accountManager: null,
            sector: null,
            city: null,
            activitySummary: null,
            href: '/clients',
          },
          activeTasks: [],
          activeVideos: [],
          nextDeadlines: [],
          operationalNotes: null,
        },
      },
      links: [],
    };
  }

  const sb = await createClient();
  if (!(await assertClientRecordVisible(sb, ctx, client.id))) {
    return { ok: false, denied: true, reason: 'Client non accessible pour votre rôle.' };
  }

  const rawClient = await getClientById(client.id, ctx);
  const tasks = await listTasksEnriched({ clientId: client.id }, ctx);
  const activeTasks = tasks
    .filter((t) => isTaskActiveForCriticalAlerts(t))
    .slice(0, AI_CONTEXT_LIMITS.tasks)
    .map(mapTask);

  const videos = (await listVideosWithClients(ctx))
    .filter((v) => v.client_id === client.id && v.status !== 'archived' && v.status !== 'cancelled')
    .slice(0, AI_CONTEXT_LIMITS.videos)
    .map(mapVideo);

  const nextDeadlines: AiClientSummaryPayload['nextDeadlines'] = [];
  for (const t of activeTasks) {
    if (t.deadline) {
      nextDeadlines.push({ label: `Tâche · ${t.title}`, date: t.deadline, href: t.href });
    }
  }
  for (const v of videos) {
    if (v.deliveryDate) {
      nextDeadlines.push({ label: `Vidéo · ${v.title}`, date: v.deliveryDate, href: v.href });
    }
  }
  nextDeadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const trimmedDeadlines = nextDeadlines.slice(0, 8);

  const notes =
    rawClient && 'notes_internal' in rawClient && typeof rawClient.notes_internal === 'string'
      ? trimText(rawClient.notes_internal, 400)
      : null;

  const summary: AiClientSummaryPayload = {
    client,
    activeTasks,
    activeVideos: videos,
    nextDeadlines: trimmedDeadlines,
    operationalNotes: notes,
  };

  const links: AiContextLink[] = [
    { label: client.name, href: client.href, kind: 'client' },
    ...taskLinks(activeTasks),
    ...videoLinks(videos),
  ];

  return {
    ok: true,
    tool: 'getClientSummary',
    empty: false,
    truncated: tasks.length > AI_CONTEXT_LIMITS.tasks || videos.length > AI_CONTEXT_LIMITS.videos,
    payload: { summary },
    links,
  };
}

export async function runAiContextTool(
  ctx: AuthContext,
  request: AiContextRequest,
): Promise<AiContextToolResult> {
  switch (request.type) {
    case 'searchTasks':
      return searchTasks(ctx, request.query, request.overdueOnly);
    case 'searchClients':
      return searchClients(ctx, request.query);
    case 'searchVideos':
      return searchVideos(ctx, request.query);
    case 'getTodayPriorities':
      return getTodayPriorities(ctx);
    case 'getClientSummary':
      return getClientSummary(ctx, request.query, request.clientId);
    default:
      return { ok: false, denied: true, reason: 'Outil non pris en charge.' };
  }
}
