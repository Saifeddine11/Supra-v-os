/**
 * Calendar events for an arbitrary [start, end) date range — RLS-scoped.
 * Tasks via tasks_select_scoped; videos via videos_select_scoped, only
 * queried when the role has video access (web nav-policy mirror).
 *
 * The hook is keyed on the range: selecting another day inside an already
 * loaded month/week re-groups in memory without refetching; only changing
 * the visible range (prev/next month, week, day) triggers a new fetch.
 *
 * Date columns (verified against the web app):
 *  - tasks:  deadline (timestamptz)
 *  - videos: shooting_date, client_delivery_at with legacy fallback
 *            delivery_deadline (see effectiveClientDeliveryIso).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { hasTaskAccess, hasVideoAccess } from '@/lib/roles';
import { logDevError, toUserMessage } from '@/lib/errors';
import { effectiveClientDeliveryIso } from '@/lib/video-meta';
import { dayKeyFromIso } from '@/lib/calendar-utils';
import type { TaskPriority, TaskStatus, UserRole, VideoStatus } from '@/types/db';
import type { TaskAssigneeInfo } from '@/hooks/useTasks';

export type CalendarEventKind = 'task' | 'shooting' | 'delivery';

export interface CalendarEvent {
  key: string;
  kind: CalendarEventKind;
  /** Task id for kind 'task'; video id otherwise. */
  entityId: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  /** ISO datetime the event is scheduled at. */
  at: string;
  /** Local 'YYYY-MM-DD' of `at`. */
  day: string;
  taskStatus: TaskStatus | null;
  taskPriority: TaskPriority | null;
  videoStatus: VideoStatus | null;
  done: boolean;
  overdue: boolean;
  assignees: TaskAssigneeInfo[];
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
  client_id: string | null;
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
  client_id: string | null;
  clients: { name: string } | null;
  video_assignments: { employees: RawEmployee | null }[] | null;
  editor: RawEmployee | null;
  cameraman: RawEmployee | null;
}

const TASK_COLUMNS =
  'id, title, status, priority, deadline, client_id, ' +
  'clients(name), ' +
  'task_assignments(employees(id, full_name, avatar_initials, avatar_color)), ' +
  'assignee:employees(id, full_name, avatar_initials, avatar_color)';

const VIDEO_COLUMNS =
  'id, title, status, shooting_date, client_delivery_at, delivery_deadline, client_id, ' +
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

// ── Builders ────────────────────────────────────────────────────────────────

function taskEvent(row: RawTaskRow, now: Date): CalendarEvent {
  const done = row.status === 'done';
  const at = row.deadline ?? '';
  return {
    key: `task-${row.id}`,
    kind: 'task',
    entityId: row.id,
    title: row.title,
    clientId: row.client_id,
    clientName: row.clients?.name ?? null,
    at,
    day: dayKeyFromIso(at),
    taskStatus: row.status,
    taskPriority: row.priority,
    videoStatus: null,
    done,
    overdue: !done && !!row.deadline && new Date(row.deadline).getTime() < now.getTime(),
    assignees: dedupeAssignees([
      ...(row.task_assignments ?? []).map((a) => a.employees),
      row.assignee,
    ]),
  };
}

function videoEvent(
  row: RawVideoRow,
  kind: 'shooting' | 'delivery',
  at: string,
  overdue: boolean,
): CalendarEvent {
  return {
    key: `${kind}-${row.id}`,
    kind,
    entityId: row.id,
    title: row.title,
    clientId: row.client_id,
    clientName: row.clients?.name ?? null,
    at,
    day: dayKeyFromIso(at),
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

// ── Fetchers (bounded, RLS-scoped) ──────────────────────────────────────────

async function fetchTasksInRange(start: Date, end: Date): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_COLUMNS)
    .neq('status', 'archived')
    .gte('deadline', start.toISOString())
    .lt('deadline', end.toISOString())
    .order('deadline', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  const now = new Date();
  return ((data ?? []) as unknown as RawTaskRow[]).map((r) => taskEvent(r, now));
}

async function fetchVideoEventsInRange(start: Date, end: Date): Promise<CalendarEvent[]> {
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
    .limit(100);
  if (error) throw new Error(error.message);

  const startMs = start.getTime();
  const endMs = end.getTime();
  const events: CalendarEvent[] = [];
  for (const row of (data ?? []) as unknown as RawVideoRow[]) {
    if (row.shooting_date) {
      const t = new Date(row.shooting_date).getTime();
      if (t >= startMs && t < endMs) {
        events.push(videoEvent(row, 'shooting', row.shooting_date, false));
      }
    }
    const deliveryIso = effectiveClientDeliveryIso(row);
    if (deliveryIso) {
      const t = new Date(deliveryIso).getTime();
      if (t >= startMs && t < endMs) {
        events.push(videoEvent(row, 'delivery', deliveryIso, false));
      }
    }
  }
  return events;
}

/** Open tasks whose deadline is already past — « En retard ». */
async function fetchOverdueTasks(before: Date): Promise<CalendarEvent[]> {
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
  return ((data ?? []) as unknown as RawTaskRow[]).map((r) => taskEvent(r, now));
}

/** Unresolved videos with a past effective delivery — « En retard ». */
async function fetchOverdueDeliveries(before: Date): Promise<CalendarEvent[]> {
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
  const events: CalendarEvent[] = [];
  for (const row of (data ?? []) as unknown as RawVideoRow[]) {
    const iso = effectiveClientDeliveryIso(row);
    if (iso && new Date(iso).getTime() < beforeMs) {
      events.push(videoEvent(row, 'delivery', iso, true));
    }
  }
  return events;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export interface CalendarEventsData {
  events: CalendarEvent[];
  /** day key → events of that day, sorted by time. */
  eventsByDay: Map<string, CalendarEvent[]>;
  /** Overdue tasks + deliveries, oldest first. */
  overdue: CalendarEvent[];
}

const EMPTY: CalendarEventsData = { events: [], eventsByDay: new Map(), overdue: [] };

export function useCalendarEvents(
  range: { start: Date; end: Date },
  role: UserRole | null,
) {
  const [data, setData] = useState<CalendarEventsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable key: refetch only when the visible range actually changes.
  const rangeKey = `${range.start.getTime()}|${range.end.getTime()}`;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [startMs, endMs] = rangeKey.split('|').map(Number);
      const start = new Date(startMs);
      const end = new Date(endMs);
      const wantTasks = hasTaskAccess(role);
      const wantVideos = hasVideoAccess(role);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [tasks, videoEvents, overdueTasks, overdueDeliveries] = await Promise.all([
        wantTasks ? fetchTasksInRange(start, end) : Promise.resolve([]),
        wantVideos ? fetchVideoEventsInRange(start, end) : Promise.resolve([]),
        wantTasks ? fetchOverdueTasks(today) : Promise.resolve([]),
        wantVideos ? fetchOverdueDeliveries(today) : Promise.resolve([]),
      ]);

      const events = [...tasks, ...videoEvents].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
      );
      const eventsByDay = new Map<string, CalendarEvent[]>();
      for (const ev of events) {
        const bucket = eventsByDay.get(ev.day);
        if (bucket) bucket.push(ev);
        else eventsByDay.set(ev.day, [ev]);
      }
      const overdue = [...overdueTasks, ...overdueDeliveries].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
      );
      setData({ events, eventsByDay, overdue });
    } catch (e) {
      logDevError('useCalendarEvents', e);
      setError(toUserMessage(e));
    }
  }, [rangeKey, role]);

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

  const result = useMemo(
    () => ({ data, loading, refreshing, error, refresh }),
    [data, loading, refreshing, error, refresh],
  );
  return result;
}
