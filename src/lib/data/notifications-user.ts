import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import type { Notification, NotificationPriority, NotificationType } from '@/types/database';

function scopeNotifications<T extends { eq(column: string, value: string): T }>(
  q: T,
  auth: AuthContext | null
): T {
  if (!auth?.role) return q;
  if (auth.role === 'admin') return q;
  return q.eq('recipient_user_id', auth.userId);
}

export async function getUnreadNotificationsCount(ctx: AuthContext | null = null): Promise<number> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  let q = supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
  q = scopeNotifications(q, auth);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listRecentNotifications(
  limit = 10,
  ctx: AuthContext | null = null
): Promise<Notification[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  let q = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  q = scopeNotifications(q, auth);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

/** Bell preview: unread first, then recent read, up to `limit`. */
export async function listBellPreview(limit = 8, ctx: AuthContext | null = null): Promise<Notification[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();

  let uq = supabase
    .from('notifications')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  uq = scopeNotifications(uq, auth);

  let recentQ = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  recentQ = scopeNotifications(recentQ, auth);

  const [unreadRes, recentRes] = await Promise.all([uq, recentQ]);
  if (unreadRes.error) throw new Error(unreadRes.error.message);
  if (recentRes.error) throw new Error(recentRes.error.message);

  const unread = (unreadRes.data ?? []) as Notification[];
  if (unread.length >= limit) return unread;
  const seen = new Set(unread.map((n) => n.id));
  const extra = ((recentRes.data ?? []) as Notification[])
    .filter((n) => !seen.has(n.id))
    .slice(0, limit - unread.length);
  return [...unread, ...extra];
}

/** Notifications créées strictement après `iso` (pour sons / polling sans rejouer l’historique). */
export async function listNotificationsCreatedAfter(
  iso: string,
  limit = 25,
  ctx: AuthContext | null = null
): Promise<Notification[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  let q = supabase
    .from('notifications')
    .select('*')
    .gt('created_at', iso)
    .order('created_at', { ascending: true })
    .limit(limit);
  q = scopeNotifications(q, auth);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function listNotificationsForPage(
  options: {
    tab?: 'all' | 'unread' | 'urgent';
    type?: NotificationType | null;
    priority?: NotificationPriority | null;
    limit?: number;
  },
  ctx: AuthContext | null = null
): Promise<Notification[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  const limit = options.limit ?? 120;

  let q = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
  q = scopeNotifications(q, auth);

  if (options.tab === 'unread') q = q.eq('is_read', false);
  if (options.tab === 'urgent') q = q.eq('priority', 'urgent');
  if (options.type) q = q.eq('type', options.type);
  if (options.priority) q = q.eq('priority', options.priority);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}
