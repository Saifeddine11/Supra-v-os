import 'server-only';

import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { casablancaYmd } from '@/lib/dates/casablanca';
import { isDiscordTaskSyncEnabled, normalizeDiscordSnowflake } from '@/lib/discord/config';
import { discordCreateChannelMessage } from '@/lib/discord/rest';
import { resolveDiscordChannelId } from '@/lib/discord/routing';
import {
  buildTaskKanbanAdvancementPayload,
  buildVideoKanbanAdvancementPayload,
} from '@/lib/discord/embed';
import { joinedRelationName } from '@/lib/supabase/joined-name';
import {
  isForwardTaskKanbanMove,
  isForwardVideoKanbanMove,
  taskKanbanColumnLabel,
  videoKanbanColumnLabel,
} from '@/types/domain';
import type { DiscordChannelRoute, TaskDepartment, TaskStatus, VideoStatus } from '@/types/database';

const scheduled = new Set<string>();

function logAdv(message: string): void {
  console.error(`[discord-kanban] ${message}`);
}

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '23505' || /duplicate key|unique constraint/i.test(error.message ?? '');
}

function runAfterResponse(work: () => Promise<void>): void {
  const wrapped = () =>
    work().catch((e) => {
      logAdv(e instanceof Error ? e.message : 'advancement failed');
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
    logAdv(`routes: ${error.message}`);
    return [];
  }
  return (data ?? []) as DiscordChannelRoute[];
}

async function claimAdvancement(
  entityType: 'task' | 'video',
  entityId: string,
  from: string,
  to: string,
): Promise<'won' | 'lost'> {
  const admin = createAdminClient();
  const { error } = await admin.from('discord_reminder_deliveries').insert({
    entity_type: entityType,
    entity_id: entityId,
    reminder_type: 'kanban_advancement',
    occurrence_date: casablancaYmd(),
    dedupe_key: `${from}>${to}`,
  });
  if (!error) return 'won';
  if (isUniqueViolation(error)) return 'lost';
  logAdv(`claim ${entityType} ${entityId}: ${error.message}`);
  return 'lost';
}

async function releaseAdvancement(
  entityType: 'task' | 'video',
  entityId: string,
  from: string,
  to: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('discord_reminder_deliveries')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('reminder_type', 'kanban_advancement')
    .eq('occurrence_date', casablancaYmd())
    .eq('dedupe_key', `${from}>${to}`);
  if (error) logAdv(`release ${entityType} ${entityId}: ${error.message}`);
}

export function scheduleTaskKanbanAdvancement(
  taskId: string | null | undefined,
  from: TaskStatus | string | null | undefined,
  to: TaskStatus | string | null | undefined,
): void {
  const id = (taskId ?? '').trim();
  if (!id || !from || !to || !isDiscordTaskSyncEnabled()) return;
  const prev = from as TaskStatus;
  const next = to as TaskStatus;
  if (!isForwardTaskKanbanMove(prev, next)) return;
  const key = `task:${id}:${prev}>${next}`;
  if (scheduled.has(key)) return;
  scheduled.add(key);
  runAfterResponse(async () => {
    try {
      await postTaskKanbanAdvancement(id, prev, next);
    } finally {
      scheduled.delete(key);
    }
  });
}

export function scheduleVideoKanbanAdvancement(
  videoId: string | null | undefined,
  from: VideoStatus | string | null | undefined,
  to: VideoStatus | string | null | undefined,
): void {
  const id = (videoId ?? '').trim();
  if (!id || !from || !to || !isDiscordTaskSyncEnabled()) return;
  const prev = from as VideoStatus;
  const next = to as VideoStatus;
  if (!isForwardVideoKanbanMove(prev, next)) return;
  const key = `video:${id}:${prev}>${next}`;
  if (scheduled.has(key)) return;
  scheduled.add(key);
  runAfterResponse(async () => {
    try {
      await postVideoKanbanAdvancement(id, prev, next);
    } finally {
      scheduled.delete(key);
    }
  });
}

async function postTaskKanbanAdvancement(
  taskId: string,
  from: TaskStatus,
  to: TaskStatus,
): Promise<void> {
  const admin = createAdminClient();
  const { data: task, error } = await admin
    .from('tasks')
    .select('id, title, client_id, department, assignee_id, video_id')
    .eq('id', taskId)
    .maybeSingle();
  if (error) {
    logAdv(`task load: ${error.message}`);
    return;
  }
  if (!task) return;
  if (task.video_id) return;

  const claimed = await claimAdvancement('task', taskId, from, to);
  if (claimed !== 'won') return;

  const [{ data: assignRows }, routes] = await Promise.all([
    admin.from('task_assignments').select('employee_id').eq('task_id', taskId),
    loadRoutes(),
  ]);
  const empIds = new Set<string>();
  for (const r of assignRows ?? []) {
    if (r.employee_id) empIds.add(r.employee_id as string);
  }
  if (task.assignee_id) empIds.add(task.assignee_id as string);

  const { data: emps } =
    empIds.size > 0
      ? await admin.from('employees').select('discord_user_id').in('id', [...empIds])
      : { data: [] as { discord_user_id: string | null }[] };

  const mentionIds = (emps ?? [])
    .map((e) => normalizeDiscordSnowflake(e.discord_user_id))
    .filter((sid): sid is string => Boolean(sid));

  const channelId = resolveDiscordChannelId(
    routes,
    (task.client_id as string | null) ?? null,
    (task.department as TaskDepartment | null) ?? null,
  );
  if (!channelId) {
    await releaseAdvancement('task', taskId, from, to);
    return;
  }

  const posted = await discordCreateChannelMessage(
    channelId,
    buildTaskKanbanAdvancementPayload({
      title: String(task.title ?? 'Tâche'),
      fromLabel: taskKanbanColumnLabel(from),
      toLabel: taskKanbanColumnLabel(to),
      mentionIds,
    }),
  );
  if (!posted.ok) {
    logAdv(`task post: ${posted.error}`);
    await releaseAdvancement('task', taskId, from, to);
  }
}

async function postVideoKanbanAdvancement(
  videoId: string,
  from: VideoStatus,
  to: VideoStatus,
): Promise<void> {
  const admin = createAdminClient();
  const { data: video, error } = await admin
    .from('videos')
    .select('id, title, client_id, clients(name)')
    .eq('id', videoId)
    .maybeSingle();
  if (error) {
    logAdv(`video load: ${error.message}`);
    return;
  }
  if (!video) return;

  const claimed = await claimAdvancement('video', videoId, from, to);
  if (claimed !== 'won') return;

  const routes = await loadRoutes();
  const channelId = resolveDiscordChannelId(
    routes,
    (video.client_id as string | null) ?? null,
    'production_video',
  );
  if (!channelId) {
    await releaseAdvancement('video', videoId, from, to);
    return;
  }

  const clientName = joinedRelationName(video.clients) ?? 'Client';

  const posted = await discordCreateChannelMessage(
    channelId,
    buildVideoKanbanAdvancementPayload({
      title: String(video.title ?? 'Vidéo'),
      fromLabel: videoKanbanColumnLabel(from),
      toLabel: videoKanbanColumnLabel(to),
      clientName,
    }),
  );
  if (!posted.ok) {
    logAdv(`video post: ${posted.error}`);
    await releaseAdvancement('video', videoId, from, to);
  }
}
