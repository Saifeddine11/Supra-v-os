/**
 * Notifications — per-user rows via RLS `notifications_select_own`
 * (recipient_user_id = auth.uid()) and `notifications_update_own`.
 * RLS is the enforcement, but the query ALSO filters on
 * recipient_user_id = current user: the select policy lets admins read all
 * notifications (web behavior); on mobile the center is personal-only, so
 * admins see just their own. Team-level signals stay on the Accueil alerts.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logDevError, toUserMessage } from '@/lib/errors';
import type { NotificationPriority } from '@/lib/notification-meta';

export interface NotificationItem {
  id: string;
  type: string;
  priority: NotificationPriority;
  title: string;
  message: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

const COLUMNS =
  'id, type, priority, title, message, related_entity_type, related_entity_id, is_read, created_at';

/**
 * Deep link target for a notification. Only task/video entities are
 * navigable on mobile; everything else (invoice, quote, digest) is web-only.
 */
export function notificationRoute(n: NotificationItem): string | null {
  if (!n.related_entity_id) return null;
  if (n.related_entity_type === 'task') return `/tasks/${n.related_entity_id}`;
  if (n.related_entity_type === 'video') return `/videos/${n.related_entity_id}`;
  return null;
}

/** Current auth user id (from the locally persisted session — no network). */
async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function fetchNotifications(): Promise<NotificationItem[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select(COLUMNS)
    .eq('recipient_user_id', uid)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationItem[];
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setNotifications(await fetchNotifications());
    } catch (e) {
      logDevError('useNotifications', e);
      setError(toUserMessage(e));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    load().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /** Optimistic single mark-as-read; RLS update_own scopes the write. */
  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    const { error: err } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('is_read', false);
    if (err) logDevError('markAsRead', err); // silent: re-sync on next refresh
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const uid = await currentUserId();
    if (!uid) return;
    // RLS update_own already restricts to self; the eq() keeps intent explicit.
    const { error: err } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_user_id', uid)
      .eq('is_read', false);
    if (err) {
      logDevError('markAllAsRead', err);
      await load();
    }
  }, [load]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
  };
}
