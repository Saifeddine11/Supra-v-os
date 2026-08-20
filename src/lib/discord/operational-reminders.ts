import 'server-only';

import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { hrefTasksOpenDetail } from '@/lib/tasks/task-deep-link';
import { hrefVideosOpenDetail } from '@/lib/videos/video-deep-link';
import {
  getDiscordValidationApproverUserId,
  isDiscordOperationalRemindersEnabled,
  normalizeDiscordSnowflake,
} from '@/lib/discord/config';
import { discordCreateChannelMessage } from '@/lib/discord/rest';
import { resolveDiscordChannelId } from '@/lib/discord/routing';
import { getDiscordStaffRoleId } from '@/lib/discord/roles';
import {
  buildShootingDayPayload,
  buildShootingJMinus1Payload,
  buildTaskDueTodayReminderPayload,
  buildTaskOverdueReminderPayload,
  buildWaitingTeamValidationPayload,
} from '@/lib/discord/embed';
import { addDaysYmd, casablancaYmd, instantCasablancaYmd } from '@/lib/dates/casablanca';
import type {
  DiscordChannelRoute,
  DiscordReminderDelivery,
  DiscordReminderType,
  TaskDepartment,
  TaskStatus,
  VideoStatus,
} from '@/types/database';

export type DiscordReminderEntityType = DiscordReminderDelivery['entity_type'];

export type OperationalRemindersResult = {
  sent: number;
  skipped: number;
  errors: string[];
};

const SHOOTING_REMINDER_STATUSES: readonly VideoStatus[] = [
  'idea',
  'brief_pending',
  'brief_validated',
  'shooting_planned',
];

const scheduledWaitingTeam = new Set<string>();

function logReminder(message: string): void {
  console.error(`[discord-reminders] ${message}`);
}

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '23505' || /duplicate key|unique constraint/i.test(error.message ?? '');
}

/** CEO / team validation only — never `blocked`. */
export function isWaitingTeamValidationStatus(status: TaskStatus | string | null | undefined): boolean {
  return status === 'waiting_team';
}

function taskUrl(taskId: string): string {
  return `${appBaseUrl()}${hrefTasksOpenDetail(taskId)}`;
}

function videoUrl(videoId: string): string {
  return `${appBaseUrl()}${hrefVideosOpenDetail(videoId)}`;
}

function runAfterResponse(work: () => Promise<void>): void {
  const wrapped = () =>
    work().catch((e) => {
      logReminder(e instanceof Error ? e.message : 'reminder failed');
    });
  try {
    after(wrapped);
  } catch {
    void wrapped();
  }
}

async function loadRoutes(): Promise<DiscordChannelRoute[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('discord_channel_routes')
    .select('id, client_id, department, discord_channel_id, is_enabled, created_at, updated_at');
  if (error) {
    logReminder(`routes: ${error.message}`);
    return [];
  }
  return (data ?? []) as DiscordChannelRoute[];
}

async function claimDelivery(
  entityType: DiscordReminderEntityType,
  entityId: string,
  reminderType: DiscordReminderType,
  occurrenceDate: string,
): Promise<'won' | 'lost'> {
  const admin = createAdminClient();
  const { error } = await admin.from('discord_reminder_deliveries').insert({
    entity_type: entityType,
    entity_id: entityId,
    reminder_type: reminderType,
    occurrence_date: occurrenceDate,
  });
  if (!error) return 'won';
  if (isUniqueViolation(error)) return 'lost';
  logReminder(`claim ${reminderType} ${entityId}: ${error.message}`);
  return 'lost';
}

async function releaseDelivery(
  entityType: DiscordReminderEntityType,
  entityId: string,
  reminderType: DiscordReminderType,
  occurrenceDate: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('discord_reminder_deliveries')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('reminder_type', reminderType)
    .eq('occurrence_date', occurrenceDate);
  if (error) logReminder(`release ${reminderType} ${entityId}: ${error.message}`);
}

async function postClaimed(input: {
  entityType: DiscordReminderEntityType;
  entityId: string;
  reminderType: DiscordReminderType;
  occurrenceDate: string;
  channelId: string;
  payload: Record<string, unknown>;
}): Promise<boolean> {
  const claimed = await claimDelivery(
    input.entityType,
    input.entityId,
    input.reminderType,
    input.occurrenceDate,
  );
  if (claimed !== 'won') return false;
  const posted = await discordCreateChannelMessage(input.channelId, input.payload);
  if (!posted.ok) {
    logReminder(`post ${input.reminderType}: ${posted.error}`);
    await releaseDelivery(input.entityType, input.entityId, input.reminderType, input.occurrenceDate);
    return false;
  }
  return true;
}

function mentionIdsForEmployees(
  empIds: Iterable<string>,
  empMap: Map<string, { discord_user_id: string | null }>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of empIds) {
    const snow = normalizeDiscordSnowflake(empMap.get(id)?.discord_user_id);
    if (!snow || seen.has(snow)) continue;
    seen.add(snow);
    out.push(snow);
  }
  return out;
}

function locationLine(client: {
  address?: string | null;
  city?: string | null;
}): string | null {
  const bits = [client.address, client.city].map((s) => (s ?? '').trim()).filter(Boolean);
  return bits.length ? bits.join(', ') : null;
}

function contactLine(client: {
  primary_contact?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
}): string | null {
  const phone = (client.phone ?? '').trim() || (client.whatsapp ?? '').trim();
  const bits = [(client.primary_contact ?? '').trim(), phone].filter(Boolean);
  return bits.length ? bits.join(' — ') : null;
}

async function loadEmployeeDiscordMap(empIds: string[]): Promise<Map<string, { discord_user_id: string | null }>> {
  const admin = createAdminClient();
  if (empIds.length === 0) return new Map();
  const { data } = await admin.from('employees').select('id, discord_user_id').in('id', empIds);
  return new Map((data ?? []).map((e) => [e.id as string, e]));
}

async function loadTaskAssigneeIds(taskIds: string[]): Promise<Map<string, Set<string>>> {
  const admin = createAdminClient();
  const map = new Map<string, Set<string>>();
  for (const id of taskIds) map.set(id, new Set());
  if (taskIds.length === 0) return map;
  const { data } = await admin.from('task_assignments').select('task_id, employee_id').in('task_id', taskIds);
  for (const row of data ?? []) {
    const tid = row.task_id as string;
    const eid = row.employee_id as string | null;
    if (!tid || !eid) continue;
    map.get(tid)?.add(eid);
  }
  return map;
}

/**
 * Immediate CEO validation ping after a successful SUPRA write. Never throws.
 */
export function scheduleWaitingTeamValidationReminder(taskId: string | null | undefined): void {
  const id = (taskId ?? '').trim();
  if (!id || !isDiscordOperationalRemindersEnabled()) return;
  if (scheduledWaitingTeam.has(id)) return;
  scheduledWaitingTeam.add(id);
  runAfterResponse(async () => {
    try {
      await sendWaitingTeamValidationReminder(id);
    } finally {
      scheduledWaitingTeam.delete(id);
    }
  });
}

export async function sendWaitingTeamValidationReminder(taskId: string): Promise<boolean> {
  if (!isDiscordOperationalRemindersEnabled()) return false;
  const admin = createAdminClient();
  const { data: task, error } = await admin
    .from('tasks')
    .select('id, title, status, client_id, assignee_id, department')
    .eq('id', taskId)
    .maybeSingle();
  if (error) {
    logReminder(`waiting_team load: ${error.message}`);
    return false;
  }
  if (!task || !isWaitingTeamValidationStatus(task.status as string)) return false;

  const routes = await loadRoutes();
  const channelId = resolveDiscordChannelId(
    routes,
    (task.client_id as string | null) ?? null,
    (task.department as TaskDepartment | null) ?? null,
  );
  if (!channelId) return false;

  const assigns = await loadTaskAssigneeIds([taskId]);
  const empIds = assigns.get(taskId) ?? new Set<string>();
  if (task.assignee_id) empIds.add(task.assignee_id as string);
  const empMap = await loadEmployeeDiscordMap([...empIds]);
  const today = casablancaYmd();

  return postClaimed({
    entityType: 'task',
    entityId: taskId,
    reminderType: 'waiting_team_validation',
    occurrenceDate: today,
    channelId,
    payload: buildWaitingTeamValidationPayload({
      title: String(task.title ?? 'Tâche'),
      approverUserId: getDiscordValidationApproverUserId(),
      assigneeMentionIds: mentionIdsForEmployees(empIds, empMap),
      taskUrl: taskUrl(taskId),
    }),
  });
}

async function sendTaskDeadlineReminders(
  routes: DiscordChannelRoute[],
  today: string,
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const admin = createAdminClient();

  const { data: tasks, error } = await admin
    .from('tasks')
    .select('id, title, status, deadline, client_id, assignee_id, department')
    .not('status', 'in', '(done,archived)')
    .not('deadline', 'is', null);
  if (error) {
    errors.push(error.message);
    return { sent, skipped, errors };
  }

  const dueToday: typeof tasks = [];
  const overdue: typeof tasks = [];
  for (const t of tasks ?? []) {
    const ymd = instantCasablancaYmd(t.deadline as string | null);
    if (!ymd) {
      skipped += 1;
      continue;
    }
    if (ymd === today) dueToday.push(t);
    else if (ymd < today) overdue.push(t);
  }

  const all = [...dueToday, ...overdue];
  const taskIds = all.map((t) => t.id as string);
  const assigns = await loadTaskAssigneeIds(taskIds);
  const empIds = new Set<string>();
  for (const t of all) {
    const s = assigns.get(t.id as string) ?? new Set<string>();
    if (t.assignee_id) s.add(t.assignee_id as string);
    assigns.set(t.id as string, s);
    for (const eid of s) empIds.add(eid);
  }
  const empMap = await loadEmployeeDiscordMap([...empIds]);

  const sendBucket = async (
    rows: NonNullable<typeof tasks>,
    reminderType: 'task_due_today' | 'task_overdue',
    build: typeof buildTaskDueTodayReminderPayload,
  ) => {
    for (const t of rows) {
      const channelId = resolveDiscordChannelId(
        routes,
        (t.client_id as string | null) ?? null,
        (t.department as TaskDepartment | null) ?? null,
      );
      if (!channelId) {
        skipped += 1;
        continue;
      }
      const ids = assigns.get(t.id as string) ?? new Set<string>();
      const ok = await postClaimed({
        entityType: 'task',
        entityId: t.id as string,
        reminderType,
        occurrenceDate: today,
        channelId,
        payload: build({
          title: String(t.title ?? 'Tâche'),
          mentionIds: mentionIdsForEmployees(ids, empMap),
          taskUrl: taskUrl(t.id as string),
        }),
      });
      if (ok) sent += 1;
      else skipped += 1;
    }
  };

  await sendBucket(dueToday, 'task_due_today', buildTaskDueTodayReminderPayload);
  await sendBucket(overdue, 'task_overdue', buildTaskOverdueReminderPayload);
  return { sent, skipped, errors };
}

async function sendWaitingTeamMorningReminders(
  routes: DiscordChannelRoute[],
  today: string,
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const admin = createAdminClient();
  const { data: tasks, error } = await admin
    .from('tasks')
    .select('id, title, status, client_id, assignee_id, department')
    .eq('status', 'waiting_team');
  if (error) {
    errors.push(error.message);
    return { sent, skipped, errors };
  }

  const list = tasks ?? [];
  const taskIds = list.map((t) => t.id as string);
  const assigns = await loadTaskAssigneeIds(taskIds);
  const empIds = new Set<string>();
  for (const t of list) {
    const s = assigns.get(t.id as string) ?? new Set<string>();
    if (t.assignee_id) s.add(t.assignee_id as string);
    assigns.set(t.id as string, s);
    for (const eid of s) empIds.add(eid);
  }
  const empMap = await loadEmployeeDiscordMap([...empIds]);
  const approverUserId = getDiscordValidationApproverUserId();

  for (const t of list) {
    const channelId = resolveDiscordChannelId(
      routes,
      (t.client_id as string | null) ?? null,
      (t.department as TaskDepartment | null) ?? null,
    );
    if (!channelId) {
      skipped += 1;
      continue;
    }
    const ids = assigns.get(t.id as string) ?? new Set<string>();
    const ok = await postClaimed({
      entityType: 'task',
      entityId: t.id as string,
      reminderType: 'waiting_team_validation',
      occurrenceDate: today,
      channelId,
      payload: buildWaitingTeamValidationPayload({
        title: String(t.title ?? 'Tâche'),
        approverUserId,
        assigneeMentionIds: mentionIdsForEmployees(ids, empMap),
        taskUrl: taskUrl(t.id as string),
      }),
    });
    if (ok) sent += 1;
    else skipped += 1;
  }
  return { sent, skipped, errors };
}

async function sendShootingReminders(
  routes: DiscordChannelRoute[],
  today: string,
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const admin = createAdminClient();
  const tomorrow = addDaysYmd(today, 1);

  const { data: videos, error } = await admin
    .from('videos')
    .select(
      'id, title, client_id, status, shooting_date, shooting_completed_at, cameraman_id, editor_id',
    )
    .not('shooting_date', 'is', null)
    .in('status', [...SHOOTING_REMINDER_STATUSES]);
  if (error) {
    errors.push(error.message);
    return { sent, skipped, errors };
  }

  const relevant = (videos ?? []).filter((v) => {
    if (v.shooting_completed_at) return false;
    const shootDay = instantCasablancaYmd(v.shooting_date as string | null);
    return shootDay === today || shootDay === tomorrow;
  });
  if (relevant.length === 0) return { sent, skipped, errors };

  const videoIds = relevant.map((v) => v.id as string);
  const clientIds = [...new Set(relevant.map((v) => v.client_id as string).filter(Boolean))];
  const [{ data: assigns }, { data: clients }] = await Promise.all([
    admin.from('video_assignments').select('video_id, employee_id, assignment_role').in('video_id', videoIds),
    clientIds.length > 0
      ? admin
          .from('clients')
          .select('id, address, city, primary_contact, phone, whatsapp')
          .in('id', clientIds)
      : Promise.resolve({ data: [] as {
          id: string;
          address: string | null;
          city: string | null;
          primary_contact: string | null;
          phone: string | null;
          whatsapp: string | null;
        }[] }),
  ]);

  const cameramenByVideo = new Map<string, Set<string>>();
  const editorsByVideo = new Map<string, Set<string>>();
  const empIds = new Set<string>();
  for (const id of videoIds) {
    cameramenByVideo.set(id, new Set());
    editorsByVideo.set(id, new Set());
  }
  for (const v of relevant) {
    const id = v.id as string;
    if (v.cameraman_id) {
      cameramenByVideo.get(id)?.add(v.cameraman_id as string);
      empIds.add(v.cameraman_id as string);
    }
    if (v.editor_id) {
      editorsByVideo.get(id)?.add(v.editor_id as string);
      empIds.add(v.editor_id as string);
    }
  }
  for (const row of assigns ?? []) {
    const vid = row.video_id as string;
    const eid = row.employee_id as string | null;
    const role = row.assignment_role as string;
    if (!vid || !eid) continue;
    empIds.add(eid);
    if (role === 'cameraman') cameramenByVideo.get(vid)?.add(eid);
    if (role === 'editor') editorsByVideo.get(vid)?.add(eid);
  }

  const empMap = await loadEmployeeDiscordMap([...empIds]);
  const clientMap = new Map(
    (clients ?? []).map((c) => [
      c.id as string,
      c as {
        address: string | null;
        city: string | null;
        primary_contact: string | null;
        phone: string | null;
        whatsapp: string | null;
      },
    ]),
  );
  const directorRoleId = getDiscordStaffRoleId('video_director');
  const directorRoles = directorRoleId ? [directorRoleId] : [];

  for (const v of relevant) {
    const id = v.id as string;
    const shootDay = instantCasablancaYmd(v.shooting_date as string | null);
    const channelId = resolveDiscordChannelId(routes, (v.client_id as string | null) ?? null, 'production_video');
    if (!channelId || !shootDay) {
      skipped += 1;
      continue;
    }
    const client = clientMap.get(v.client_id as string);
    const loc = client ? locationLine(client) : null;
    const contact = client ? contactLine(client) : null;
    const cams = cameramenByVideo.get(id) ?? new Set<string>();
    const editors = editorsByVideo.get(id) ?? new Set<string>();

    if (shootDay === tomorrow) {
      const mentionUserIds = mentionIdsForEmployees(new Set([...cams, ...editors]), empMap);
      const ok = await postClaimed({
        entityType: 'video',
        entityId: id,
        reminderType: 'shooting_j_minus_1',
        occurrenceDate: today,
        channelId,
        payload: buildShootingJMinus1Payload({
          title: String(v.title ?? 'Vidéo'),
          videoUrl: videoUrl(id),
          mentionUserIds,
          mentionRoleIds: directorRoles,
          locationLine: loc,
          contactLine: contact,
        }),
      });
      if (ok) sent += 1;
      else skipped += 1;
    }

    if (shootDay === today) {
      const mentionUserIds = mentionIdsForEmployees(cams, empMap);
      const ok = await postClaimed({
        entityType: 'video',
        entityId: id,
        reminderType: 'shooting_day',
        occurrenceDate: today,
        channelId,
        payload: buildShootingDayPayload({
          title: String(v.title ?? 'Vidéo'),
          videoUrl: videoUrl(id),
          mentionUserIds,
          mentionRoleIds: directorRoles,
          locationLine: loc,
          contactLine: contact,
        }),
      });
      if (ok) sent += 1;
      else skipped += 1;
    }
  }

  return { sent, skipped, errors };
}

/**
 * Morning operational Discord reminders. Reused from runMorningReminders / daily cron.
 */
export async function runDiscordOperationalReminders(): Promise<OperationalRemindersResult> {
  const empty: OperationalRemindersResult = { sent: 0, skipped: 0, errors: [] };
  if (!isDiscordOperationalRemindersEnabled()) return empty;

  try {
    const today = casablancaYmd();
    const routes = await loadRoutes();
    const [deadlines, waiting, shooting] = await Promise.all([
      sendTaskDeadlineReminders(routes, today),
      sendWaitingTeamMorningReminders(routes, today),
      sendShootingReminders(routes, today),
    ]);
    return {
      sent: deadlines.sent + waiting.sent + shooting.sent,
      skipped: deadlines.skipped + waiting.skipped + shooting.skipped,
      errors: [...deadlines.errors, ...waiting.errors, ...shooting.errors],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'operational reminders failed';
    logReminder(msg);
    return { sent: 0, skipped: 0, errors: [msg] };
  }
}
