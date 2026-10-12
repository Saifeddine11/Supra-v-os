import 'server-only';

import { revalidatePath } from 'next/cache';
import type { AuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { scheduleVideoKanbanAdvancement } from '@/lib/discord/kanban-advancement';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { getEmployeeUserId, getUserIdsByRoles, insertNotifications } from '@/lib/notifications/notify';
import type { TaskStatus, VideoPublicStatus, VideoStatus } from '@/types/database';

/**
 * Kanban column « Tournage ». The next production status is `editing`
 * (« Montage en cours »). `in_editing` is the portal public status, not `videos.status`.
 */
export const TOURNAGE_VIDEO_STATUSES = [
  'shooting_planned',
  'shooting_in_progress',
  'shooting_done',
  'rushes_received',
] as const satisfies readonly VideoStatus[];

export const EDITING_VIDEO_STATUS = 'editing' satisfies VideoStatus;
export const EDITING_PUBLIC_STATUS = 'in_editing' satisfies VideoPublicStatus;

const PUBLIC_BEFORE_EDITING: readonly VideoPublicStatus[] = [
  'topic_proposed',
  'brief_validated',
  'shooting_planned',
  'in_production',
];

/** Production task created with the video (`tasks.video_id`, one row per video). */
export function isShootingProductionTask(task: {
  video_id: string | null;
  department: string | null;
}): boolean {
  return Boolean(task.video_id) && task.department === 'production_video';
}

export function nextVideoStatusAfterShootingValidated(status: VideoStatus): VideoStatus | null {
  return (TOURNAGE_VIDEO_STATUSES as readonly string[]).includes(status) ? EDITING_VIDEO_STATUS : null;
}

/**
 * When a shooting task is validated as `done`, move the linked video out of Tournage
 * into Montage. Does nothing for pending validation, unrelated tasks, or videos
 * already past shooting. Never moves a video backward.
 */
export async function syncVideoAfterValidatedShootingTask(input: {
  ctx: AuthContext;
  taskId: string;
  previousStatus: TaskStatus | null;
  nextStatus: TaskStatus;
}): Promise<void> {
  if (input.nextStatus !== 'done' || input.previousStatus === 'done') return;

  try {
    const admin = createAdminClient();
    const { data: task, error: taskErr } = await admin
      .from('tasks')
      .select('id, title, video_id, department')
      .eq('id', input.taskId)
      .maybeSingle();
    if (taskErr || !task) {
      if (taskErr) console.error('[syncVideoAfterValidatedShootingTask] task', taskErr.message);
      return;
    }
    if (!isShootingProductionTask(task)) return;

    const videoId = task.video_id as string;
    const { data: video, error: videoErr } = await admin
      .from('videos')
      .select('id, title, status, public_status, shooting_completed_at, editor_id')
      .eq('id', videoId)
      .maybeSingle();
    if (videoErr || !video) {
      if (videoErr) console.error('[syncVideoAfterValidatedShootingTask] video', videoErr.message);
      return;
    }

    const fromStatus = video.status as VideoStatus;
    const toStatus = nextVideoStatusAfterShootingValidated(fromStatus);
    if (!toStatus) return;

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: toStatus,
      updated_at: now,
    };
    if (!video.shooting_completed_at) patch.shooting_completed_at = now;
    const publicStatus = video.public_status as VideoPublicStatus | null;
    if (!publicStatus || PUBLIC_BEFORE_EDITING.includes(publicStatus)) {
      patch.public_status = EDITING_PUBLIC_STATUS;
    }

    const { data: updated, error: upErr } = await admin
      .from('videos')
      .update(patch)
      .eq('id', videoId)
      .in('status', [...TOURNAGE_VIDEO_STATUSES])
      .select('id')
      .maybeSingle();
    if (upErr) {
      console.error('[syncVideoAfterValidatedShootingTask] update', upErr.message);
      return;
    }
    if (!updated) return;

    const actorLabel = input.ctx.employee?.full_name?.trim() || input.ctx.email || null;
    const { error: logErr } = await admin.from('activity_logs').insert([
      {
        actor_user_id: input.ctx.userId,
        actor_label: actorLabel,
        action: 'task_completed',
        entity_type: 'task',
        entity_id: input.taskId,
        metadata: {
          title: task.title,
          status: 'done',
          video_id: videoId,
        },
      },
      {
        actor_user_id: input.ctx.userId,
        actor_label: actorLabel,
        action: 'video_status_auto_updated',
        entity_type: 'video',
        entity_id: videoId,
        metadata: {
          title: video.title,
          from_status: fromStatus,
          to_status: toStatus,
          reason: 'shooting_task_validated',
          task_id: input.taskId,
          task_title: task.title,
        },
      },
    ]);
    if (logErr) console.error('[syncVideoAfterValidatedShootingTask] activity', logErr.message);

    scheduleVideoKanbanAdvancement(videoId, fromStatus, toStatus);
    await notifyEditingStarted(admin, input.ctx.userId, videoId, String(video.title ?? 'Vidéo'), video.editor_id as string | null);

    revalidatePath('/videos');
    revalidatePath('/tasks');
    revalidatePath('/tasks/calendar');
    revalidatePath('/dashboard');
  } catch (e) {
    console.error(
      '[syncVideoAfterValidatedShootingTask]',
      e instanceof Error ? e.message : 'sync failed',
    );
  }
}

async function notifyEditingStarted(
  admin: ReturnType<typeof createAdminClient>,
  actorUserId: string,
  videoId: string,
  videoTitle: string,
  editorId: string | null,
): Promise<void> {
  const recipients = new Set<string>(await getUserIdsByRoles(['admin', 'project_manager']));
  const editorIds = new Set<string>();
  if (editorId) editorIds.add(editorId);
  const { data: assignments } = await admin
    .from('video_assignments')
    .select('employee_id')
    .eq('video_id', videoId)
    .eq('assignment_role', 'editor');
  for (const row of assignments ?? []) {
    const employeeId = (row as { employee_id: string | null }).employee_id;
    if (employeeId) editorIds.add(employeeId);
  }
  for (const employeeId of editorIds) {
    const userId = await getEmployeeUserId(employeeId);
    if (userId) recipients.add(userId);
  }
  recipients.delete(actorUserId);
  if (recipients.size === 0) return;

  const base = appBaseUrl();
  await insertNotifications(
    [...recipients].map((recipient_user_id) => ({
      recipient_user_id,
      type: 'system' as const,
      priority: 'normal' as const,
      title: 'Vidéo en montage',
      message: `« ${videoTitle} » passe en montage : la tâche de tournage a été validée.`,
      related_entity_type: 'video',
      related_entity_id: videoId,
      link_url: `${base}/videos`,
    })),
  );
}
