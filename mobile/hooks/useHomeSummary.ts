/**
 * Role-aware home summary + derived critical alerts. Small RLS-scoped count
 * queries only — the server decides what each role can see; finance/commercial
 * simply get zero task queries because the UI never asks (hasTaskAccess /
 * hasVideoAccess). Overdue-delivery rule mirrors the web's
 * isVideoDeliveryOverdueActive (status/public_status resolved ⇒ not overdue).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { hasTaskAccess, hasVideoAccess } from '@/lib/roles';
import { logDevError, toUserMessage } from '@/lib/errors';
import type { UserRole } from '@/types/db';

export interface HomeSummary {
  openTasks: number | null;
  dueToday: number | null;
  overdue: number | null;
  activeVideos: number | null;
  /** Critical alerts (null = not applicable for role). */
  overdueDeliveries: number | null;
  shootingsToday: number | null;
  unreadNotifications: number | null;
}

const EMPTY: HomeSummary = {
  openTasks: null,
  dueToday: null,
  overdue: null,
  activeVideos: null,
  overdueDeliveries: null,
  shootingsToday: null,
  unreadNotifications: null,
};

const OPEN_TASK_STATUSES = '("todo","in_progress","waiting_client","waiting_team","review","blocked")';
const ACTIVE_VIDEO_EXCLUDED = '("published","archived","cancelled")';
const DELIVERY_RESOLVED = '("validated","published","archived","cancelled")';
const PUBLIC_RESOLVED = '("validated","published")';

function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

async function countTasks(filter: (q: any) => any): Promise<number> {
  let query = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .filter('status', 'in', OPEN_TASK_STATUSES);
  query = filter(query);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countVideos(filter: (q: any) => any): Promise<number> {
  let query = supabase.from('videos').select('id', { count: 'exact', head: true });
  query = filter(query);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Overdue deliveries = effective delivery date past AND video not resolved.
 * Two count queries because the effective date spans two columns
 * (client_delivery_at, legacy date-only delivery_deadline).
 */
async function countOverdueDeliveries(): Promise<number> {
  const nowIso = new Date().toISOString();
  const todayDate = todayISODate();
  const notResolved = (q: any) =>
    q
      .filter('status', 'not.in', DELIVERY_RESOLVED)
      .filter('public_status', 'not.in', PUBLIC_RESOLVED);

  const [withTimestamp, legacyOnly] = await Promise.all([
    countVideos((q) => notResolved(q).lt('client_delivery_at', nowIso)),
    countVideos((q) =>
      notResolved(q).is('client_delivery_at', null).lt('delivery_deadline', todayDate),
    ),
  ]);
  return withTimestamp + legacyOnly;
}

export function useHomeSummary(role: UserRole | null) {
  const [summary, setSummary] = useState<HomeSummary>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const today = todayISODate();
    const next: HomeSummary = { ...EMPTY };
    try {
      const jobs: PromiseLike<void>[] = [];

      if (hasTaskAccess(role)) {
        jobs.push(
          countTasks((q) => q).then((n) => {
            next.openTasks = n;
          }),
          countTasks((q) =>
            q.gte('deadline', today).lt('deadline', `${today}T23:59:59`),
          ).then((n) => {
            next.dueToday = n;
          }),
          countTasks((q) => q.lt('deadline', today).not('deadline', 'is', null)).then(
            (n) => {
              next.overdue = n;
            },
          ),
        );
      }

      if (hasVideoAccess(role)) {
        jobs.push(
          countVideos((q) => q.filter('status', 'not.in', ACTIVE_VIDEO_EXCLUDED)).then(
            (n) => {
              next.activeVideos = n;
            },
          ),
          countOverdueDeliveries().then((n) => {
            next.overdueDeliveries = n;
          }),
          countVideos((q) =>
            q
              .filter('status', 'not.in', '("archived","cancelled")')
              .gte('shooting_date', startOfTodayIso())
              .lt('shooting_date', endOfTodayIso()),
          ).then((n) => {
            next.shootingsToday = n;
          }),
        );
      }

      // Unread notifications — personal only (the select RLS lets admins read
      // all rows; the recipient filter keeps the badge to the signed-in user).
      jobs.push(
        supabase.auth.getSession().then(async ({ data: sess }) => {
          const uid = sess.session?.user?.id;
          if (!uid) {
            next.unreadNotifications = 0;
            return;
          }
          const { count, error: nErr } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_user_id', uid)
            .eq('is_read', false);
          if (nErr) throw new Error(nErr.message);
          next.unreadNotifications = count ?? 0;
        }),
      );

      await Promise.all(jobs);
      setSummary(next);
    } catch (e) {
      logDevError('useHomeSummary', e);
      setError(toUserMessage(e));
    }
  }, [role]);

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

  return { summary, loading, refreshing, error, refresh, reload: load };
}
