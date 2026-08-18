import 'server-only';

import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { hrefTasksOpenDetail } from '@/lib/tasks/task-deep-link';
import {
  getDiscordBotToken,
  isDiscordTaskSyncEnabled,
  normalizeDiscordSnowflake,
} from '@/lib/discord/config';
import {
  discordCreateChannelMessage,
  discordDeleteChannelMessage,
  discordEditChannelMessage,
} from '@/lib/discord/rest';
import { resolveDiscordChannelId } from '@/lib/discord/routing';
import {
  buildDeadlineReminderPayload,
  buildDiscordTestPayload,
  buildMorningDigestPayload,
  buildTaskDiscordPayload,
} from '@/lib/discord/embed';
import { TEAM_ASSIGNABLE_ROLES } from '@/types/domain';
import type {
  DiscordChannelRoute,
  TaskPriority,
  TaskStatus,
  UserRole,
} from '@/types/database';

type DiscordLink = {
  task_id: string;
  discord_channel_id: string;
  discord_message_id: string;
  last_reminder_at: string | null;
};

function logDiscord(message: string): void {
  console.error(`[discord] ${message}`);
}

function taskUrl(taskId: string): string {
  return `${appBaseUrl()}${hrefTasksOpenDetail(taskId)}`;
}

async function loadRoutes(): Promise<DiscordChannelRoute[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('discord_channel_routes')
    .select('id, client_id, department_role, discord_channel_id, is_enabled, created_at, updated_at');
  if (error) {
    logDiscord(`routes: ${error.message}`);
    return [];
  }
  return (data ?? []) as DiscordChannelRoute[];
}

async function loadLink(taskId: string): Promise<DiscordLink | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('task_discord_messages')
    .select('task_id, discord_channel_id, discord_message_id, last_reminder_at')
    .eq('task_id', taskId)
    .maybeSingle();
  if (error) {
    logDiscord(`link read: ${error.message}`);
    return null;
  }
  return (data as DiscordLink | null) ?? null;
}

async function upsertLink(taskId: string, channelId: string, messageId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from('task_discord_messages').upsert(
    {
      task_id: taskId,
      discord_channel_id: channelId,
      discord_message_id: messageId,
      updated_at: now,
    },
    { onConflict: 'task_id' },
  );
  if (error) logDiscord(`link upsert: ${error.message}`);
}

function runAfterResponse(work: () => Promise<void>): void {
  const wrapped = () =>
    work().catch((e) => {
      logDiscord(e instanceof Error ? e.message : 'sync failed');
    });
  try {
    after(wrapped);
  } catch {
    void wrapped();
  }
}

/**
 * Fire-and-forget after a successful task write. Never throws to the caller.
 */
export function scheduleTaskDiscordUpsert(taskId: string | null | undefined): void {
  const id = (taskId ?? '').trim();
  if (!id || !isDiscordTaskSyncEnabled()) return;
  runAfterResponse(() => syncTaskToDiscord(id));
}

/**
 * Capture linkage before deleting the task (CASCADE would drop the row).
 */
export async function peekTaskDiscordLink(
  taskId: string,
): Promise<{ channelId: string; messageId: string } | null> {
  try {
    if (!getDiscordBotToken()) return null;
    const link = await loadLink(taskId);
    if (!link) return null;
    return { channelId: link.discord_channel_id, messageId: link.discord_message_id };
  } catch (e) {
    logDiscord(e instanceof Error ? e.message : 'peek link failed');
    return null;
  }
}

export function scheduleTaskDiscordRemoved(
  link: { channelId: string; messageId: string } | null,
): void {
  if (!link || !getDiscordBotToken()) return;
  runAfterResponse(async () => {
    const res = await discordDeleteChannelMessage(link.channelId, link.messageId);
    if (!res.ok && res.status !== 404) {
      logDiscord(`delete message: ${res.error}`);
    }
  });
}

export async function syncTaskToDiscord(taskId: string): Promise<void> {
  if (!isDiscordTaskSyncEnabled()) return;

  const admin = createAdminClient();
  const { data: task, error: taskErr } = await admin
    .from('tasks')
    .select('id, title, status, priority, deadline, client_id, assignee_id')
    .eq('id', taskId)
    .maybeSingle();
  if (taskErr) {
    logDiscord(`task load: ${taskErr.message}`);
    return;
  }
  if (!task) return;

  const [{ data: assignRows }, { data: clientRow }, routes, existing] = await Promise.all([
    admin.from('task_assignments').select('employee_id').eq('task_id', taskId),
    task.client_id
      ? admin.from('clients').select('name').eq('id', task.client_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
    loadRoutes(),
    loadLink(taskId),
  ]);

  const assigneeIds = new Set<string>();
  for (const r of assignRows ?? []) {
    if (r.employee_id) assigneeIds.add(r.employee_id as string);
  }
  if (task.assignee_id) assigneeIds.add(task.assignee_id as string);

  const empIds = [...assigneeIds];
  const { data: emps } =
    empIds.length > 0
      ? await admin
          .from('employees')
          .select('id, full_name, role, discord_user_id')
          .in('id', empIds)
      : { data: [] as { id: string; full_name: string; role: UserRole; discord_user_id: string | null }[] };

  const employees = emps ?? [];
  const primary =
    employees.find((e) => e.id === task.assignee_id) ?? employees[0] ?? null;
  const departmentRole = (primary?.role as UserRole | undefined) ?? null;
  const channelId = resolveDiscordChannelId(
    routes,
    (task.client_id as string | null) ?? null,
    departmentRole,
  );
  if (!channelId) return;

  const mentionIds = employees
    .map((e) => normalizeDiscordSnowflake(e.discord_user_id))
    .filter((id): id is string => Boolean(id));
  const payload = buildTaskDiscordPayload({
    title: String(task.title ?? 'Tâche'),
    clientName: clientRow?.name ? String(clientRow.name) : null,
    assigneeNames: employees.map((e) => e.full_name),
    mentionIds,
    deadline: (task.deadline as string | null) ?? null,
    priority: task.priority as TaskPriority,
    status: task.status as TaskStatus,
    taskUrl: taskUrl(taskId),
  });

  if (
    existing &&
    existing.discord_channel_id === channelId &&
    existing.discord_message_id
  ) {
    const edited = await discordEditChannelMessage(
      channelId,
      existing.discord_message_id,
      payload,
    );
    if (edited.ok) return;
    if (edited.status !== 404) {
      logDiscord(`edit message: ${edited.error}`);
      return;
    }
  } else if (existing) {
    const del = await discordDeleteChannelMessage(
      existing.discord_channel_id,
      existing.discord_message_id,
    );
    if (!del.ok && del.status !== 404) {
      logDiscord(`move delete: ${del.error}`);
    }
  }

  const created = await discordCreateChannelMessage(channelId, payload);
  if (!created.ok) {
    logDiscord(`create message: ${created.error}`);
    return;
  }
  await upsertLink(taskId, created.data.channel_id || channelId, created.data.id);
}

const REMINDER_WINDOW_MS = 20 * 3600_000;

type ReminderTask = {
  id: string;
  title: string;
  deadline: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  priority: TaskPriority;
  client_id: string | null;
};

/**
 * Batched Discord deadline pings from rows already loaded by runDeadlineAlerts.
 */
export async function sendDiscordDeadlineReminders(input: {
  soon: ReminderTask[];
  overdue: ReminderTask[];
}): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  const tagged: { task: ReminderTask; kind: 'soon' | 'overdue' }[] = [
    ...input.soon.map((task) => ({ task, kind: 'soon' as const })),
    ...input.overdue.map((task) => ({ task, kind: 'overdue' as const })),
  ];
  if (!isDiscordTaskSyncEnabled() || tagged.length === 0) {
    return { sent, skipped };
  }

  try {
    const admin = createAdminClient();
    const taskIds = [...new Set(tagged.map((t) => t.task.id))];
    const [routes, linksRes, assignsRes] = await Promise.all([
      loadRoutes(),
      admin
        .from('task_discord_messages')
        .select('task_id, discord_channel_id, discord_message_id, last_reminder_at')
        .in('task_id', taskIds),
      admin.from('task_assignments').select('task_id, employee_id').in('task_id', taskIds),
    ]);

    const linkByTask = new Map(
      ((linksRes.data ?? []) as DiscordLink[]).map((l) => [l.task_id, l]),
    );
    const empIds = new Set<string>();
    const assigneesByTask = new Map<string, Set<string>>();
    for (const { task: t } of tagged) {
      const s = assigneesByTask.get(t.id) ?? new Set<string>();
      if (t.assignee_id) {
        s.add(t.assignee_id);
        empIds.add(t.assignee_id);
      }
      assigneesByTask.set(t.id, s);
    }
    for (const row of assignsRes.data ?? []) {
      const tid = row.task_id as string;
      const eid = row.employee_id as string | null;
      if (!tid || !eid) continue;
      const s = assigneesByTask.get(tid) ?? new Set<string>();
      s.add(eid);
      assigneesByTask.set(tid, s);
      empIds.add(eid);
    }

    const { data: emps } =
      empIds.size > 0
        ? await admin
            .from('employees')
            .select('id, role, discord_user_id')
            .in('id', [...empIds])
        : { data: [] as { id: string; role: UserRole; discord_user_id: string | null }[] };
    const empMap = new Map((emps ?? []).map((e) => [e.id as string, e]));

    const now = Date.now();
    for (const { task: t, kind } of tagged) {
      const link = linkByTask.get(t.id);
      if (link?.last_reminder_at) {
        const last = new Date(link.last_reminder_at).getTime();
        if (!Number.isNaN(last) && now - last < REMINDER_WINDOW_MS) {
          skipped += 1;
          continue;
        }
      }

      const ids = [...(assigneesByTask.get(t.id) ?? [])];
      const primary = empMap.get(t.assignee_id ?? ids[0] ?? '');
      const channelId =
        link?.discord_channel_id ??
        resolveDiscordChannelId(routes, t.client_id, (primary?.role as UserRole | undefined) ?? null);
      if (!channelId) {
        skipped += 1;
        continue;
      }

      const mentionIds = ids
        .map((id) => normalizeDiscordSnowflake(empMap.get(id)?.discord_user_id))
        .filter((id): id is string => Boolean(id));
      const posted = await discordCreateChannelMessage(
        channelId,
        buildDeadlineReminderPayload({
          kind,
          title: t.title,
          mentionIds,
          taskUrl: taskUrl(t.id),
        }),
      );
      if (!posted.ok) {
        logDiscord(`deadline reminder: ${posted.error}`);
        skipped += 1;
        continue;
      }
      sent += 1;
      if (link) {
        const { error } = await admin
          .from('task_discord_messages')
          .update({ last_reminder_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('task_id', t.id);
        if (error) logDiscord(`reminder stamp: ${error.message}`);
      }
    }
  } catch (e) {
    logDiscord(e instanceof Error ? e.message : 'deadline reminders failed');
  }
  return { sent, skipped };
}

export async function sendDiscordMorningDigest(input: {
  employeeId: string;
  fullName: string;
  discordUserId: string | null;
  role: UserRole | null;
  dueToday: { id: string; title: string; clientId: string | null }[];
  overdue: { id: string; title: string; clientId: string | null }[];
  urgent: { id: string; title: string; clientId: string | null }[];
}): Promise<boolean> {
  if (!isDiscordTaskSyncEnabled()) return false;
  try {
    const mentionId = normalizeDiscordSnowflake(input.discordUserId);
    const routes = await loadRoutes();
    const grouped = new Map<string, { dueToday: string[]; overdue: string[]; urgent: string[] }>();

    const add = (
      channelId: string | null,
      bucket: 'dueToday' | 'overdue' | 'urgent',
      title: string,
    ) => {
      if (!channelId) return;
      const cur = grouped.get(channelId) ?? { dueToday: [], overdue: [], urgent: [] };
      cur[bucket].push(title);
      grouped.set(channelId, cur);
    };

    for (const t of input.dueToday) {
      add(resolveDiscordChannelId(routes, t.clientId, input.role), 'dueToday', t.title);
    }
    for (const t of input.overdue) {
      add(resolveDiscordChannelId(routes, t.clientId, input.role), 'overdue', t.title);
    }
    for (const t of input.urgent) {
      add(resolveDiscordChannelId(routes, t.clientId, input.role), 'urgent', t.title);
    }

    if (grouped.size === 0) return false;

    const tasksUrl = `${appBaseUrl()}/tasks`;
    let any = false;
    for (const [channelId, lists] of grouped) {
      const posted = await discordCreateChannelMessage(
        channelId,
        buildMorningDigestPayload({
          recipientName: input.fullName,
          mentionId,
          dueToday: lists.dueToday,
          overdue: lists.overdue,
          urgent: lists.urgent,
          tasksUrl,
        }),
      );
      if (!posted.ok) {
        logDiscord(`morning digest: ${posted.error}`);
        continue;
      }
      any = true;
    }
    return any;
  } catch (e) {
    logDiscord(e instanceof Error ? e.message : 'morning digest failed');
    return false;
  }
}

export async function postDiscordTestMessage(channelId: string): Promise<{ ok: boolean; error?: string }> {
  const id = normalizeDiscordSnowflake(channelId);
  if (!id) return { ok: false, error: 'channel_id must be a Discord snowflake (17–20 digits).' };
  if (!getDiscordBotToken()) return { ok: false, error: 'DISCORD_BOT_TOKEN is not set.' };
  const res = await discordCreateChannelMessage(id, buildDiscordTestPayload());
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function listDiscordAdminStatus(): Promise<{
  tokenConfigured: boolean;
  syncEnabled: boolean;
  routes: DiscordChannelRoute[];
  employeesMissingDiscordId: { id: string; full_name: string; role: UserRole }[];
  activeClients: { id: string; name: string }[];
  departmentRoles: UserRole[];
}> {
  const tokenConfigured = Boolean(getDiscordBotToken());
  const syncEnabled = isDiscordTaskSyncEnabled();
  const empty = {
    tokenConfigured,
    syncEnabled,
    routes: [] as DiscordChannelRoute[],
    employeesMissingDiscordId: [] as { id: string; full_name: string; role: UserRole }[],
    activeClients: [] as { id: string; name: string }[],
    departmentRoles: TEAM_ASSIGNABLE_ROLES,
  };
  try {
    const admin = createAdminClient();
    const [routes, emps, clients] = await Promise.all([
      loadRoutes(),
      admin
        .from('employees')
        .select('id, full_name, role')
        .eq('is_active', true)
        .is('archived_at', null)
        .is('discord_user_id', null)
        .neq('role', 'client')
        .order('full_name'),
      admin.from('clients').select('id, name').eq('status', 'active').order('name'),
    ]);
    return {
      tokenConfigured,
      syncEnabled,
      routes,
      employeesMissingDiscordId: (emps.data ?? []) as { id: string; full_name: string; role: UserRole }[],
      activeClients: (clients.data ?? []) as { id: string; name: string }[],
      departmentRoles: TEAM_ASSIGNABLE_ROLES,
    };
  } catch (e) {
    logDiscord(e instanceof Error ? e.message : 'admin status failed');
    return empty;
  }
}

export async function upsertDiscordChannelRoute(input: {
  clientId: string | null;
  departmentRole: UserRole | null;
  channelId: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const channelId = normalizeDiscordSnowflake(input.channelId);
  if (!channelId) return { ok: false, error: 'discord_channel_id must be a 17–20 digit snowflake.' };
  if (input.departmentRole === 'client') {
    return { ok: false, error: 'department_role cannot be client.' };
  }
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    let find = admin.from('discord_channel_routes').select('id');
    find = input.clientId ? find.eq('client_id', input.clientId) : find.is('client_id', null);
    find = input.departmentRole
      ? find.eq('department_role', input.departmentRole)
      : find.is('department_role', null);
    const { data: existing, error: findErr } = await find.maybeSingle();
    if (findErr) return { ok: false, error: findErr.message };

    if (existing?.id) {
      const { error } = await admin
        .from('discord_channel_routes')
        .update({
          discord_channel_id: channelId,
          is_enabled: true,
          updated_at: now,
        })
        .eq('id', existing.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: existing.id as string };
    }

    const { data, error } = await admin
      .from('discord_channel_routes')
      .insert({
        client_id: input.clientId,
        department_role: input.departmentRole,
        discord_channel_id: channelId,
        is_enabled: true,
        updated_at: now,
      })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'route upsert failed' };
  }
}
