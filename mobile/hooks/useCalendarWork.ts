/**
 * Calendar data — task deadlines + video shootings/deliveries, RLS-scoped.
 * Tasks come through tasks_select_scoped; videos through videos_select_scoped;
 * video events are only queried at all when the role has video access
 * (hasVideoAccess mirror of web nav-policy). Minimal columns, bounded results.
 *
 * Date columns (verified against the web app):
 *  - tasks:  deadline (timestamptz)
 *  - videos: shooting_date (timestamptz),
 *            client_delivery_at (timestamptz) with legacy fallback
 *            delivery_deadline (date) — see effectiveClientDeliveryIso.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { hasTaskAccess, hasVideoAccess } from '@/lib/roles';
import { logDevError, toUserMessage } from '@/lib/errors';
import { effectiveClientDeliveryIso } from '@/lib/video-meta';
import type { TaskPriority, TaskStatus, UserRole, VideoStatus } from '@/types/db';
import type { TaskAssigneeInfo } from '@/hooks/useTasks';

export type CalendarRange = 'today' | 'tomorrow' | 'week' | 'upcoming';

export const CALENDAR_RANGES: { key: CalendarRange; label: string }[] = [
  { key: 'today', label: 'Aujourd’hui' },
  { key: 'tomorrow', label: 'Demain' },
  { key: 'week', label: 'Cette semaine' },
  { key: 'upcoming', label: 'À venir' },
];

export type CalendarItemKind = 'task' | 'shooting' | 'delivery';

export interface CalendarItem {
  key: string;
  kind: CalendarItemKind;
  /** Task id for kind 'task'; video id otherwise. */
  entityId: string;
  title: string;
  clientName: string | null;
  /** ISO datetime the item is scheduled at. */
  at: string;
  taskStatus: TaskStatus | null;
  taskPriority: TaskPriority | null;
  videoStatus: VideoStatus | null;
  done: boolean;
  overdue: boolean;
  assignees: TaskAssigneeInfo[];
}

export interface CalendarData {
  /** « En retard » section (tasks + video deliveries) — 'today' range only. */
  overdueItems: CalendarItem[];
  items: CalendarItem[];
}

const EMPTY_DATA: CalendarData = { overdueItems: [], items: [] };

// ── Local date ranges ───────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** [start, end] as Date pair for the selected chip, in local time. */
export function rangeBounds(range: CalendarRange, now = new Date()): { start: Date; end: Date } {
  const today = startOfDay(now);
  switch (range) {
    case 'today':
      return { start: today, end: addDays(today, 1) };
    case 'tomorrow':
      return { start: addDays(today, 1), end: addDays(today, 2) };
    case 'week': {
      // Monday-based week: today through end of Sunday.
      const mondayIndex = (today.getDay() + 6) % 7; // 0 = Monday
      return { start: today, end: addDays(today, 7 - mondayIndex) };
    }
    case 'upcoming':
      return { start: today, end: addDays(today, 30) };
  }
}

// ── Row shapes (minimal columns) ────────────────────────────────────────────

interface RawEmployee {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  avatar_color: string | null;
}

interface RawTaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  clients: { name: string } | null;
  task_assignments: { employees: RawEmployee | null }[] | null;
  assignee: RawEmployee | null;
}

interface RawVideoRow {
  id: string;
  title: string;
  status: VideoStatus;
  shooting_date: string | null;
  client_delivery_at: string | null;
  delivery_deadline: string | null;
  clients: { name: string } | null;
  video_assignments: { employees: RawEmployee | null }[] | null;
  editor: RawEmployee | null;
  cameraman: RawEmployee | null;
}

const TASK_COLUMNS =
  'id, title, status, priority, deadline, ' +
  'clients(name), ' +
  'task_assignments(employees(id, full_name, avatar_initials, avatar_color)), ' +
  'assignee:employees(id, full_name, avatar_initials, avatar_color)';

const VIDEO_COLUMNS =
  'id, title, status, shooting_date, client_delivery_at, delivery_deadline, ' +
  'clients(name), ' +
  'video_assignments(employees(id, full_name, avatar_initials, avatar_color)), ' +
  'editor:employees!editor_id(id, full_name, avatar_initials, avatar_color), ' +
  'cameraman:employees!cameraman_id(id, full_name, avatar_initials, avatar_color)';

function dedupeAssignees(list: (RawEmployee | null | undefined)[]): TaskAssigneeInfo[] {
  const out: TaskAssigneeInfo[] = [];
  const seen = new Set<string>();
  for (const e of list) {
    if (e && !seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}

// ── Fetchers ────────────────────────────────────────────────────────────────

function taskItem(row: RawTaskRow, now: Date): CalendarItem {
  const done = row.status === 'done';
  return {
    key: `task-${row.id}`,
    kind: 'task',
    entityId: row.id,
    title: row.title,
    clientName: row.clients?.name ?? null,
    at: row.deadline ?? '',
    taskStatus: row.status,
    taskPriority: row.priority,
    videoStatus: null,
    done,
    overdue:
      !done && !!row.deadline && new Date(row.deadline).getTime() < now.getTime(),
    assignees: dedupeAssignees([
      ...(row.task_assignments ?? []).map((a) => a.employees),
      row.assignee,
    ]),
  };
}

async function fetchTasksInRange(start: Date, end: Date): Promise<CalendarItem[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_COLUMNS)
    .neq('status', 'archived')
    .gte('deadline', start.toISOString())
    .lt('deadline', end.toISOString())
    .order('deadline', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  const now = new Date();
  return ((data ?? []) as unknown as RawTaskRow[]).map((r) => taskItem(r, now));
}

/** Open tasks whose deadline is already past (shown under « En retard »). */
async function fetchOverdueTasks(before: Date): Promise<CalendarItem[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_COLUMNS)
    .filter('status', 'not.in', '("done","archived")')
    .not('deadline', 'is', null)
    .lt('deadline', before.toISOString())
    .order('deadline', { ascending: true })
    .limit(25);
  if (error) throw new Error(error.message);
  const now = new Date();
  return ((data ?? []) as unknown as RawTaskRow[]).map((r) => taskItem(r, now));
}

function deliveryItem(row: RawVideoRow, at: string, overdue: boolean): CalendarItem {
  return {
    key: `delivery-${row.id}`,
    kind: 'delivery',
    entityId: row.id,
    title: row.title,
    clientName: row.clients?.name ?? null,
    at,
    taskStatus: null,
    taskPriority: null,
    videoStatus: row.status,
    done: false,
    overdue,
    assignees: dedupeAssignees([
      ...(row.video_assignments ?? []).map((a) => a.employees),
      row.editor,
      row.cameraman,
    ]),
  };
}

/**
 * Unresolved videos whose effective delivery date is already past
 * (shown under « En retard » with the overdue tasks). Mirrors the web's
 * isVideoDeliveryOverdueActive resolution rule.
 */
async function fetchOverdueDeliveries(before: Date): Promise<CalendarItem[]> {
  const s = before.toISOString();
  const sDate = s.slice(0, 10);
  const { data, error } = await supabase
    .from('videos')
    .select(VIDEO_COLUMNS)
    .filter('status', 'not.in', '("validated","published","archived","cancelled")')
    .filter('public_status', 'not.in', '("validated","published")')
    .or(
      [
        `client_delivery_at.lt.${s}`,
        `and(client_delivery_at.is.null,delivery_deadline.lt.${sDate})`,
      ].join(','),
    )
    .limit(25);
  if (error) throw new Error(error.message);

  const beforeMs = before.getTime();
  const items: CalendarItem[] = [];
  for (const row of (data ?? []) as unknown as RawVideoRow[]) {
    const iso = effectiveClientDeliveryIso(row);
    if (iso && new Date(iso).getTime() < beforeMs) {
      items.push(deliveryItem(row, iso, true));
    }
  }
  items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return items;
}

/**
 * Videos with a shooting or delivery date in range. The server-side .or()
 * bounds the fetch; exact per-event inclusion (incl. the legacy
 * delivery_deadline fallback) is recomputed below with effective dates.
 */
async function fetchVideoEventsInRange(start: Date, end: Date): Promise<CalendarItem[]> {
  const s = start.toISOString();
  const e = end.toISOString();
  const sDate = s.slice(0, 10);
  const eDate = e.slice(0, 10);
  const { data, error } = await supabase
    .from('videos')
    .select(VIDEO_COLUMNS)
    .filter('status', 'not.in', '("archived","cancelled")')
    .or(
      [
        `and(shooting_date.gte.${s},shooting_date.lt.${e})`,
        `and(client_delivery_at.gte.${s},client_delivery_at.lt.${e})`,
        `and(delivery_deadline.gte.${sDate},delivery_deadline.lte.${eDate})`,
      ].join(','),
    )
    .limit(50);
  if (error) throw new Error(error.message);

  const startMs = start.getTime();
  const endMs = end.getTime();
  const items: CalendarItem[] = [];

  for (const row of (data ?? []) as unknown as RawVideoRow[]) {
    const base = {
      title: row.title,
      clientName: row.clients?.name ?? null,
      taskStatus: null,
      taskPriority: null,
      videoStatus: row.status,
      done: false,
      overdue: false,
      assignees: dedupeAssignees([
        ...(row.video_assignments ?? []).map((a) => a.employees),
        row.editor,
        row.cameraman,
      ]),
    };

    if (row.shooting_date) {
      const t = new Date(row.shooting_date).getTime();
      if (t >= startMs && t < endMs) {
        items.push({
          ...base,
          key: `shooting-${row.id}`,
          kind: 'shooting',
          entityId: row.id,
          at: row.shooting_date,
        });
      }
    }

    const deliveryIso = effectiveClientDeliveryIso(row);
    if (deliveryIso) {
      const t = new Date(deliveryIso).getTime();
      if (t >= startMs && t < endMs) {
        items.push({
          ...base,
          key: `delivery-${row.id}`,
          kind: 'delivery',
          entityId: row.id,
          at: deliveryIso,
        });
      }
    }
  }
  return items;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useCalendarWork(range: CalendarRange, role: UserRole | null) {
  const [data, setData] = useState<CalendarData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { start, end } = rangeBounds(range);
      const wantTasks = hasTaskAccess(role);
      const wantVideos = hasVideoAccess(role);

      const [tasks, overdueTasks, overdueDeliveries, videoEvents] = await Promise.all([
        wantTasks ? fetchTasksInRange(start, end) : Promise.resolve([]),
        wantTasks && range === 'today' ? fetchOverdueTasks(start) : Promise.resolve([]),
        wantVideos && range === 'today' ? fetchOverdueDeliveries(start) : Promise.resolve([]),
        wantVideos ? fetchVideoEventsInRange(start, end) : Promise.resolve([]),
      ]);

      const items = [...tasks, ...videoEvents].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
      );
      const overdueItems = [...overdueTasks, ...overdueDeliveries].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
      );
      setData({ overdueItems, items });
    } catch (e) {
      logDevError('useCalendarWork', e);
      setError(toUserMessage(e));
    }
  }, [range, role]);

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

  return { data, loading, refreshing, error, refresh };
}
