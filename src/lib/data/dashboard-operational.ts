import 'server-only';

import { endOfDay, format, formatDistanceToNow, isBefore, isWithinInterval, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { canViewGlobalFinanceStats, canViewInvoices } from '@/lib/auth/capabilities';
import { fetchManagedClientIds, hasFullOrgDataAccess } from '@/lib/auth/data-scope';
import type {
  ClientFollowMock,
  ProjectRowMock,
  TaskRowMock,
  UrgentItem,
  VideoRowMock,
  WorkloadMember,
} from '@/data/dashboard-mock';
import type { InvoiceStatus, TaskPriority, UserRole, VideoStatus } from '@/types/database';
import { INVOICE_STATUS_MAP, ROLE_LABELS, VIDEO_STATUS_MAP } from '@/types/domain';
import { formatAgencyMoneyCompact } from '@/lib/money/format-money';
import { getAgencyDisplayCurrency } from '@/lib/data/agency-settings-db';
import { fetchAssignmentsForTasks, formatTaskAssigneeSummary } from '@/lib/data/task-assignments';
import { getClientColor } from '@/lib/ui/client-colors';

const ACTIVE_PROJECT_STATUSES = ['in_progress', 'waiting_client', 'waiting_content', 'review'] as const;

function videoTone(status: VideoStatus): VideoRowMock['tone'] {
  if (status === 'client_revision' || status === 'sent_to_client') return 'warning';
  if (status === 'validated' || status === 'published') return 'success';
  return 'default';
}

function labelTaskAssignees(
  taskId: string,
  legacyAssigneeId: string | null,
  assignMap: Map<string, { id: string; full_name: string }[]>,
  empName: Map<string, string>,
): string {
  const people = assignMap.get(taskId) ?? [];
  if (people.length > 0) {
    const s = formatTaskAssigneeSummary(people);
    return s || 'Non assigné';
  }
  if (legacyAssigneeId) return empName.get(legacyAssigneeId) ?? 'Non assigné';
  return 'Non assigné';
}

function invoiceIsOpenDebt(row: { status: InvoiceStatus; due_date: string }): boolean {
  if (row.status === 'overdue') return true;
  if (row.status === 'sent' || row.status === 'pending') {
    return row.due_date < format(new Date(), 'yyyy-MM-dd');
  }
  return false;
}

function taskDueLabel(deadline: string | null, overdue: boolean): string {
  if (!deadline) return 'Sans date';
  const d = new Date(deadline);
  if (overdue) {
    return `En retard · ${formatDistanceToNow(d, { addSuffix: true, locale: fr })}`;
  }
  return format(d, "d MMM yyyy · HH:mm", { locale: fr });
}

export interface DashboardOperationalBlocks {
  urgentItems: UrgentItem[];
  videoStatusCounts: { label: string; count: number }[];
  productionVideos: VideoRowMock[];
  teamTasksToday: TaskRowMock[];
  teamTasksOverdue: TaskRowMock[];
  teamWorkload: WorkloadMember[];
  clientsFollow: ClientFollowMock[];
  projectsOngoing: ProjectRowMock[];
}

/** Clients actifs du portefeuille commercial — mêmes signaux que la vue agence, sans données fictives. */
export async function fetchCommercialClientsFollow(ctx: AuthContext): Promise<ClientFollowMock[]> {
  if (!ctx.employee || ctx.role !== 'commercial') return [];

  const supabase = await createClient();
  const ids = await fetchManagedClientIds(supabase, ctx.employee.id);
  if (ids.length === 0) return [];

  const [activeClients, invR, portalsR, videosR] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, color_hex, updated_at')
      .in('id', ids)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(14),
    supabase
      .from('invoices')
      .select('client_id, due_date, status')
      .in('client_id', ids)
      .in('status', ['overdue', 'sent', 'pending'])
      .limit(200),
    supabase.from('client_portals').select('client_id').eq('is_active', true).in('client_id', ids),
    supabase
      .from('videos')
      .select('client_id, public_status, status')
      .in('client_id', ids)
      .limit(400),
  ]);

  const portalSet = new Set((portalsR.data ?? []).map((p) => p.client_id as string));
  const validationClients = new Set<string>();
  for (const v of videosR.data ?? []) {
    const ps = v.public_status as string | undefined;
    const st = v.status as string;
    if (ps === 'in_validation' || st === 'sent_to_client') {
      const cid = v.client_id as string | undefined;
      if (cid) validationClients.add(cid);
    }
  }

  const overdueByClient = new Set<string>();
  for (const inv of invR.data ?? []) {
    if (invoiceIsOpenDebt(inv as { status: InvoiceStatus; due_date: string })) {
      overdueByClient.add(inv.client_id as string);
    }
  }

  return (activeClients.data ?? []).map((c) => {
    const id = c.id as string;
    let tag: ClientFollowMock['tag'] = 'active';
    let note = 'Client actif';
    if (overdueByClient.has(id)) {
      tag = 'invoice';
      note = 'Facture en retard ou échue';
    } else if (validationClients.has(id)) {
      tag = 'follow-up';
      note = 'Vidéo en validation ou envoyée au client';
    } else if (portalSet.has(id)) {
      tag = 'portal';
      note = 'Portail client actif';
    }
    const name = c.name as string;
    const color_hex = (c as { color_hex?: string | null }).color_hex ?? null;
    return {
      id,
      name,
      note,
      tag,
      brandHex: getClientColor({ name, color_hex }),
    };
  });
}

export function emptyDashboardOperational(): DashboardOperationalBlocks {
  return {
    urgentItems: [],
    videoStatusCounts: [],
    productionVideos: [],
    teamTasksToday: [],
    teamTasksOverdue: [],
    teamWorkload: [],
    clientsFollow: [],
    projectsOngoing: [],
  };
}

/**
 * Blocs opérationnels (admin / chef de projet uniquement) — aucune donnée fictive.
 */
export async function fetchDashboardOperational(ctx: AuthContext): Promise<DashboardOperationalBlocks> {
  if (!ctx.employee || !hasFullOrgDataAccess(ctx)) {
    return emptyDashboardOperational();
  }

  const supabase = await createClient();
  const currency = await getAgencyDisplayCurrency();
  const canQueryInvoices = canViewInvoices(ctx.role);
  const showInvoiceAmountsInFeed = canViewGlobalFinanceStats(ctx.role);
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const [
    employeesR,
    tasksOpenR,
    videosR,
    invoicesR,
    projectsR,
    internalR,
    reportsR,
    portalsR,
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, role, weekly_capacity')
      .is('archived_at', null)
      .eq('is_active', true),
    supabase
      .from('tasks')
      .select(
        'id, title, deadline, priority, status, assignee_id, estimated_hours, client_id, clients(name, color_hex)',
      )
      .not('status', 'in', '(done,archived)')
      .limit(500),
    supabase
      .from('videos')
      .select('id, title, status, public_status, client_id, updated_at, clients(name, color_hex)')
      .order('updated_at', { ascending: false })
      .limit(400),
    canQueryInvoices
      ? showInvoiceAmountsInFeed
        ? supabase
            .from('invoices')
            .select('id, client_id, due_date, status, total, clients(name, color_hex)')
            .in('status', ['overdue', 'sent', 'pending'])
            .limit(200)
        : supabase
            .from('invoices')
            .select('id, client_id, due_date, status, clients(name, color_hex)')
            .in('status', ['overdue', 'sent', 'pending'])
            .limit(200)
      : Promise.resolve({ data: [] as { id: string; client_id: string; due_date: string; status: string; total?: number; clients: { name?: string; color_hex?: string | null } | null }[], error: null }),
    supabase
      .from('projects')
      .select('id, title, progress, status, notes_internal, clients(name)')
      .in('status', [...ACTIVE_PROJECT_STATUSES])
      .order('updated_at', { ascending: false })
      .limit(40),
    supabase
      .from('internal_projects')
      .select('id, title, progress, status, notes')
      .in('status', [...ACTIVE_PROJECT_STATUSES])
      .order('updated_at', { ascending: false })
      .limit(40),
    supabase
      .from('reports')
      .select('id, title, client_id, clients(name, color_hex)')
      .is('sent_at', null)
      .limit(25),
    supabase.from('client_portals').select('client_id').eq('is_active', true),
  ]);

  const employees = employeesR.data ?? [];
  const empName = new Map(employees.map((e) => [e.id as string, e.full_name as string]));

  const openTasks = tasksOpenR.data ?? [];
  const taskAssignMap = await fetchAssignmentsForTasks(
    supabase,
    openTasks.map((t) => t.id as string),
  );

  /** --- Vidéos : compteurs + pipeline --- */
  const videoRows = videosR.data ?? [];
  const validationClients = new Set<string>();
  for (const v of videoRows) {
    const ps = v.public_status as string | undefined;
    const st = v.status as string;
    if (ps === 'in_validation' || st === 'sent_to_client') {
      const cid = v.client_id as string | undefined;
      if (cid) validationClients.add(cid);
    }
  }

  const statusCountMap = new Map<string, number>();
  for (const v of videoRows) {
    const st = v.status as string;
    statusCountMap.set(st, (statusCountMap.get(st) ?? 0) + 1);
  }
  const videoStatusCounts = [...statusCountMap.entries()]
    .map(([status, count]) => ({
      label: VIDEO_STATUS_MAP[status as VideoStatus]?.label ?? status,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const productionVideos: VideoRowMock[] = videoRows
    .filter((v) => !['published', 'archived', 'cancelled'].includes(v.status as string))
    .slice(0, 12)
    .map((v) => {
      const cl = v.clients as { name?: string; color_hex?: string | null } | null;
      const client = cl?.name ?? '—';
      const st = v.status as VideoStatus;
      return {
        id: v.id as string,
        title: v.title as string,
        client,
        clientBrandHex: getClientColor({ name: client === '—' ? 'Client' : client, color_hex: cl?.color_hex ?? null }),
        status: VIDEO_STATUS_MAP[st]?.label ?? st,
        tone: videoTone(st),
      };
    });

  /** --- Tâches équipe --- */
  const todayTasks: TaskRowMock[] = [];
  const overdueTasks: TaskRowMock[] = [];

  for (const t of openTasks) {
    const dl = t.deadline as string | null;
    if (!dl) continue;
    const d = new Date(dl);
    const assignee = labelTaskAssignees(
      t.id as string,
      (t.assignee_id as string | null) ?? null,
      taskAssignMap,
      empName,
    );
    const pr = t.priority as TaskPriority;
    const overdue = isBefore(d, dayStart);
    const crow = (t as { clients?: { name?: string; color_hex?: string | null } | null }).clients;
    const clientName = crow?.name ?? null;
    const clientBrandHex = clientName
      ? getClientColor({ name: clientName, color_hex: crow?.color_hex ?? null })
      : null;

    const row: TaskRowMock = {
      id: t.id as string,
      title: t.title as string,
      assignee,
      due: taskDueLabel(dl, overdue),
      priority: pr,
      overdue,
      clientName,
      clientBrandHex,
    };

    if (overdue) {
      overdueTasks.push(row);
    } else if (isWithinInterval(d, { start: dayStart, end: dayEnd })) {
      todayTasks.push(row);
    }
  }

  todayTasks.sort((a, b) => {
    const pr = { urgent: 0, high: 1, normal: 2, low: 3 };
    return (pr[a.priority] ?? 9) - (pr[b.priority] ?? 9);
  });
  overdueTasks.sort((a, b) => {
    const pr = { urgent: 0, high: 1, normal: 2, low: 3 };
    return (pr[a.priority] ?? 9) - (pr[b.priority] ?? 9);
  });

  /** --- Charge équipe --- */
  const hoursByAssignee = new Map<string, number>();
  for (const t of openTasks) {
    const pivot = taskAssignMap.get(t.id as string) ?? [];
    const assigneeIds =
      pivot.length > 0 ? pivot.map((p) => p.id) : t.assignee_id ? [t.assignee_id as string] : [];
    if (assigneeIds.length === 0) continue;
    const h = Number(t.estimated_hours);
    const base = Number.isFinite(h) && h > 0 ? h : 4;
    const split = base / assigneeIds.length;
    for (const aid of assigneeIds) {
      hoursByAssignee.set(aid, (hoursByAssignee.get(aid) ?? 0) + split);
    }
  }

  const teamWorkload: WorkloadMember[] = employees.map((e) => {
    const id = e.id as string;
    const cap = Math.max(Number(e.weekly_capacity) || 40, 1);
    const hours = hoursByAssignee.get(id) ?? 0;
    const pct = Math.min(100, Math.round((hours / cap) * 100));
    return {
      name: e.full_name as string,
      role: ROLE_LABELS[e.role as UserRole] ?? String(e.role),
      percent: pct,
    };
  });

  /** --- Clients à suivre --- */
  const portalSet = new Set((portalsR.data ?? []).map((p) => p.client_id as string));

  const invRows = invoicesR.data ?? [];
  const overdueByClient = new Set<string>();
  for (const inv of invRows) {
    if (invoiceIsOpenDebt(inv as { status: InvoiceStatus; due_date: string })) {
      overdueByClient.add(inv.client_id as string);
    }
  }

  const { data: activeClients } = await supabase
    .from('clients')
    .select('id, name, color_hex, updated_at')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(14);

  const clientsFollow: ClientFollowMock[] = (activeClients ?? []).map((c) => {
    const id = c.id as string;
    const name = c.name as string;
    const color_hex = (c as { color_hex?: string | null }).color_hex ?? null;
    let tag: ClientFollowMock['tag'] = 'active';
    let note = 'Client actif';
    if (overdueByClient.has(id)) {
      tag = 'invoice';
      note = 'Facture en retard ou échue';
    } else if (validationClients.has(id)) {
      tag = 'follow-up';
      note = 'Vidéo en validation ou envoyée au client';
    } else if (portalSet.has(id)) {
      tag = 'portal';
      note = 'Portail client actif';
    }
    return { id, name, note, tag, brandHex: getClientColor({ name, color_hex }) };
  });

  /** --- Projets --- */
  const projectsOngoing: ProjectRowMock[] = [
    ...(projectsR.data ?? []).map((p) => ({
      id: p.id as string,
      name: p.title as string,
      progress: Number(p.progress) || 0,
      type: 'client' as const,
      blocker: (p.notes_internal as string | null)?.trim() || undefined,
    })),
    ...(internalR.data ?? []).map((p) => ({
      id: p.id as string,
      name: p.title as string,
      progress: Number(p.progress) || 0,
      type: 'internal' as const,
      blocker: (p.notes as string | null)?.trim() || undefined,
    })),
  ].slice(0, 24);

  /** --- Urgent aujourd’hui --- */
  const urgentAcc: UrgentItem[] = [];

  for (const inv of invRows) {
    const row = inv as {
      id: string;
      due_date: string;
      status: InvoiceStatus;
      total?: number;
      clients: { name?: string; color_hex?: string | null } | null;
    };
    if (!invoiceIsOpenDebt(row)) continue;
    const name = row.clients?.name ?? 'Client';
    const clientBrandHex = getClientColor({ name, color_hex: row.clients?.color_hex ?? null });
    urgentAcc.push({
      id: `inv-${row.id}`,
      type: 'Facture',
      title: showInvoiceAmountsInFeed
        ? `${name} — ${formatAgencyMoneyCompact(Number(row.total), currency)}`
        : `${name} — facture à vérifier`,
      detail: showInvoiceAmountsInFeed
        ? row.status === 'overdue'
          ? `Statut ${INVOICE_STATUS_MAP.overdue.label}`
          : `Échéance ${row.due_date} · ${INVOICE_STATUS_MAP[row.status].label}`
        : 'Suivi administratif — montant non affiché sur ce rôle',
      severity: 'high',
      clientBrandHex,
    });
  }

  for (const t of openTasks) {
    if (t.priority !== 'urgent') continue;
    const dl = t.deadline as string | null;
    const overdue = dl ? isBefore(new Date(dl), dayStart) : false;
    const assignee = labelTaskAssignees(
      t.id as string,
      (t.assignee_id as string | null) ?? null,
      taskAssignMap,
      empName,
    );
    const uc = (t as { clients?: { name?: string; color_hex?: string | null } | null }).clients;
    const un = uc?.name ?? null;
    const clientBrandHex = un ? getClientColor({ name: un, color_hex: uc?.color_hex ?? null }) : null;
    urgentAcc.push({
      id: `task-${t.id}`,
      type: 'Tâche',
      title: t.title as string,
      detail: [
        assignee !== 'Non assigné' ? `Assignés : ${assignee}` : null,
        dl ? taskDueLabel(dl, overdue) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      severity: 'high',
      clientBrandHex,
    });
  }

  for (const v of videoRows) {
    const ps = v.public_status as string | undefined;
    if (ps === 'in_validation' || v.status === 'sent_to_client') {
      const cl = v.clients as { name?: string; color_hex?: string | null } | null;
      const client = cl?.name ?? '';
      const clientBrandHex = client
        ? getClientColor({ name: client, color_hex: cl?.color_hex ?? null })
        : null;
      urgentAcc.push({
        id: `vid-${v.id}`,
        type: 'Validation',
        title: `${v.title as string}${client ? ` — ${client}` : ''}`,
        detail: 'Validation ou retour client attendu',
        severity: 'medium',
        clientBrandHex,
      });
    }
  }

  for (const r of reportsR.data ?? []) {
    const cl = r.clients as { name?: string; color_hex?: string | null } | null;
    const client = cl?.name ?? '';
    const clientBrandHex = client
      ? getClientColor({ name: client, color_hex: cl?.color_hex ?? null })
      : null;
    urgentAcc.push({
      id: `rep-${r.id}`,
      type: 'Rapport',
      title: `${r.title as string}${client ? ` — ${client}` : ''}`,
      detail: 'Rapport non envoyé',
      severity: 'medium',
      clientBrandHex,
    });
  }

  urgentAcc.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'high' ? -1 : 1;
  });

  return {
    urgentItems: urgentAcc.slice(0, 14),
    videoStatusCounts,
    productionVideos,
    teamTasksToday: todayTasks.slice(0, 12),
    teamTasksOverdue: overdueTasks.slice(0, 12),
    teamWorkload,
    clientsFollow,
    projectsOngoing,
  };
}
