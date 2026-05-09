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
  const { data: unread, error: e1 } = await uq;
  if (e1) throw new Error(e1.message);
  const u = (unread ?? []) as Notification[];
  if (u.length >= limit) return u;

  let rq = supabase
    .from('notifications')
    .select('*')
    .eq('is_read', true)
    .order('created_at', { ascending: false })
    .limit(limit - u.length);
  rq = scopeNotifications(rq, auth);
  const { data: rest, error: e2 } = await rq;
  if (e2) throw new Error(e2.message);
  return [...u, ...((rest ?? []) as Notification[])];
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
