import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { NotificationPriority, NotificationType, UserRole } from '@/types/database';

export type NotificationInsert = {
  recipient_user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  link_url?: string | null;
};

/**
 * Insert one or more notifications (service role — bypasses RLS).
 */
export async function insertNotifications(rows: NotificationInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin.from('notifications').insert(
    rows.map((r) => ({
      recipient_user_id: r.recipient_user_id,
      type: r.type,
      priority: r.priority,
      title: r.title,
      message: r.message,
      related_entity_type: r.related_entity_type ?? null,
      related_entity_id: r.related_entity_id ?? null,
      link_url: r.link_url ?? null,
      updated_at: now,
    }))
  );
}

export type DedupeKey = {
  recipientUserId: string;
  type: NotificationType;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  /** Dedupe window in hours (default 24). */
  windowHours?: number;
};

/**
 * Creates a notification unless an equivalent one exists in the time window.
 * Returns true if inserted, false if skipped as duplicate.
 */
export async function createNotificationOnce(
  row: NotificationInsert,
  dedupe: DedupeKey
): Promise<{ inserted: boolean }> {
  const windowHours = dedupe.windowHours ?? 24;
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const admin = createAdminClient();

  let q = admin
    .from('notifications')
    .select('id')
    .eq('recipient_user_id', dedupe.recipientUserId)
    .eq('type', dedupe.type)
    .gte('created_at', since)
    .limit(1);

  if (dedupe.relatedEntityType != null) {
    q = q.eq('related_entity_type', dedupe.relatedEntityType);
  } else {
    q = q.is('related_entity_type', null);
  }
  if (dedupe.relatedEntityId != null) {
    q = q.eq('related_entity_id', dedupe.relatedEntityId);
  } else {
    q = q.is('related_entity_id', null);
  }

  const { data: existing } = await q.maybeSingle();
  if (existing) return { inserted: false };

  await insertNotifications([row]);
  return { inserted: true };
}

export async function getEmployeeUserId(employeeId: string | null | undefined): Promise<string | null> {
  if (!employeeId) return null;
  const admin = createAdminClient();
  const { data } = await admin.from('employees').select('user_id').eq('id', employeeId).maybeSingle();
  return data?.user_id ?? null;
}

export async function getUserIdsByRoles(roles: UserRole[]): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('employees')
    .select('user_id')
    .in('role', roles)
    .eq('is_active', true)
    .is('archived_at', null)
    .not('user_id', 'is', null);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.user_id) ids.add(row.user_id);
  }
  return [...ids];
}

/** Admin + commercial — finance alerts, quotes, invoices. */
export async function getFinanceAlertUserIds(): Promise<string[]> {
  return getUserIdsByRoles(['admin', 'commercial', 'finance']);
}

/** Notify all admins and project managers (in-app). */
export async function notifyAdminsAndPMs(opts: {
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  linkUrl?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): Promise<void> {
  const userIds = await getUserIdsByRoles(['admin', 'project_manager']);
  if (userIds.length === 0) return;

  const rows: NotificationInsert[] = userIds.map((recipient_user_id) => ({
    recipient_user_id,
    type: opts.type,
    priority: opts.priority ?? 'high',
    title: opts.title,
    message: opts.message,
    related_entity_type: opts.relatedEntityType ?? null,
    related_entity_id: opts.relatedEntityId ?? null,
    link_url: opts.linkUrl ?? null,
  }));

  await insertNotifications(rows);
}

export async function notifyFinanceTeam(opts: {
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  linkUrl?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): Promise<void> {
  const userIds = await getFinanceAlertUserIds();
  if (userIds.length === 0) return;
  await insertNotifications(
    userIds.map((recipient_user_id) => ({
      recipient_user_id,
      type: opts.type,
      priority: opts.priority ?? 'high',
      title: opts.title,
      message: opts.message,
      related_entity_type: opts.relatedEntityType ?? null,
      related_entity_id: opts.relatedEntityId ?? null,
      link_url: opts.linkUrl ?? null,
    }))
  );
}
