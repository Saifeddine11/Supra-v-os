import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logPortalActivity } from '@/lib/portal/notify-staff';
import { emailStaffAboutClientFeedback } from '@/lib/portal/portal-staff-email';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import {
  getEmployeeUserId,
  getUserIdsByRoles,
  insertNotifications,
  type NotificationInsert,
} from '@/lib/notifications/notify';
import { scheduleVideoKanbanAdvancement } from '@/lib/discord/kanban-advancement';
import type { VideoStatus } from '@/types/database';

async function collectEditorUserIds(videoId: string, editorId: string | null): Promise<string[]> {
  const admin = createAdminClient();
  const { data: asg } = await admin
    .from('video_assignments')
    .select('employee_id')
    .eq('video_id', videoId)
    .eq('assignment_role', 'editor');
  const employeeIds = new Set<string>();
  for (const r of asg ?? []) {
    if (r.employee_id) employeeIds.add(r.employee_id as string);
  }
  if (editorId) employeeIds.add(editorId);
  const userIds: string[] = [];
  for (const empId of employeeIds) {
    const uid = await getEmployeeUserId(empId);
    if (uid) userIds.push(uid);
  }
  return userIds;
}

async function collectAdminPmUserIds(): Promise<string[]> {
  return getUserIdsByRoles(['admin', 'project_manager']);
}

async function collectClientUserIds(clientId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('client_users')
    .select('user_id')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .not('user_id', 'is', null);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.user_id) ids.add(row.user_id as string);
  }
  return [...ids];
}

function uniqueRows(rows: NotificationInsert[]): NotificationInsert[] {
  const seen = new Set<string>();
  const out: NotificationInsert[] = [];
  for (const r of rows) {
    const k = `${r.recipient_user_id}:${r.type}:${r.related_entity_id}:${r.title}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Called when a video is newly released to the client (`sent_to_client`). */
export async function notifyVideoReleasedToClient(opts: {
  videoId: string;
  title: string;
  clientId: string;
  editorId: string | null;
  prevStatus: VideoStatus;
  nextStatus: VideoStatus;
}): Promise<void> {
  if (opts.nextStatus !== 'sent_to_client') return;
  if (opts.prevStatus === 'sent_to_client') return;

  const base = appBaseUrl();
  const [editors, clients] = await Promise.all([
    collectEditorUserIds(opts.videoId, opts.editorId),
    collectClientUserIds(opts.clientId),
  ]);

  const rows: NotificationInsert[] = [];
  for (const uid of editors) {
    rows.push({
      recipient_user_id: uid,
      type: 'system',
      priority: 'normal',
      title: 'Vidéo envoyée au client',
      message: opts.title,
      related_entity_type: 'video',
      related_entity_id: opts.videoId,
      link_url: `${base}/videos`,
    });
  }
  for (const uid of clients) {
    rows.push({
      recipient_user_id: uid,
      type: 'document_uploaded',
      priority: 'high',
      title: 'Nouvelle version à revoir',
      message: `« ${opts.title} » est prête pour votre relecture.`,
      related_entity_type: 'video',
      related_entity_id: opts.videoId,
      link_url: '/client/videos',
    });
  }
  const uniq = uniqueRows(rows);
  if (uniq.length) await insertNotifications(uniq);
}

export async function notifyClientRevisionSubmitted(opts: {
  videoId: string;
  title: string;
  clientName: string;
  editorId: string | null;
  replayed: boolean;
}): Promise<void> {
  if (opts.replayed) return;
  const base = appBaseUrl();
  const [editors, admins] = await Promise.all([
    collectEditorUserIds(opts.videoId, opts.editorId),
    collectAdminPmUserIds(),
  ]);
  const recipients = [...new Set([...editors, ...admins])];
  const rows: NotificationInsert[] = recipients.map((recipient_user_id) => ({
    recipient_user_id,
    type: 'client_revision_requested',
    priority: 'high',
    title: 'Révision demandée',
    message: `Le client demande une révision pour « ${opts.title} ».`,
    related_entity_type: 'video',
    related_entity_id: opts.videoId,
    link_url: `${base}/videos`,
  }));
  if (rows.length) await insertNotifications(rows);
  await emailStaffAboutClientFeedback({
    clientName: opts.clientName,
    entityTitle: opts.title,
    feedbackType: 'revision_requested',
    comment: null,
    entityPath: '/videos',
  });
  await logPortalActivity({
    action: 'video_revision_requested_by_client',
    entityType: 'video',
    entityId: opts.videoId,
    metadata: { source: 'video_review_api' },
  });
}

export async function notifyClientApproved(opts: {
  videoId: string;
  title: string;
  clientName: string;
  prevStatus: VideoStatus;
  replayed: boolean;
}): Promise<void> {
  if (opts.replayed) return;
  const base = appBaseUrl();
  const admins = await collectAdminPmUserIds();
  const rows: NotificationInsert[] = admins.map((recipient_user_id) => ({
    recipient_user_id,
    type: 'client_validated',
    priority: 'high',
    title: 'Validation client',
    message: `Le client a validé la vidéo « ${opts.title} ».`,
    related_entity_type: 'video',
    related_entity_id: opts.videoId,
    link_url: `${base}/videos`,
  }));
  if (rows.length) await insertNotifications(rows);
  scheduleVideoKanbanAdvancement(opts.videoId, opts.prevStatus, 'validated');
  await emailStaffAboutClientFeedback({
    clientName: opts.clientName,
    entityTitle: opts.title,
    feedbackType: 'approved',
    comment: null,
    entityPath: '/videos',
  });
  await logPortalActivity({
    action: 'video_validated_by_client',
    entityType: 'video',
    entityId: opts.videoId,
    metadata: { source: 'video_review_api' },
  });
}

