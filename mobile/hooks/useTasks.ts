/**
 * Task data access — direct Supabase queries, RLS-scoped
 * (tasks_select_scoped / tasks_update_assigned_or_admin in supabase/policies.sql).
 * Minimal columns only, 50 rows max, no select('*').
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logDevError, toUserMessage } from '@/lib/errors';
import type { TaskPriority, TaskStatus } from '@/types/db';

export interface TaskAssigneeInfo {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  avatar_color: string | null;
}

export interface TaskListItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  completed_at: string | null;
  client_id: string | null;
  client_name: string | null;
  assignees: TaskAssigneeInfo[];
}

export interface LinkedVideoInfo {
  id: string;
  title: string;
  status: string;
}

export interface TaskDetail extends TaskListItem {
  description: string | null;
  video_id: string | null;
  /** Linked video, when RLS lets the user see it (null otherwise — no leak). */
  linkedVideo: LinkedVideoInfo | null;
  created_at: string;
  updated_at: string;
}

export type TaskFilter =
  | 'all'
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'blocked'
  | 'done'
  | 'overdue';

export const TASK_FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'todo', label: 'À faire' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'review', label: 'En révision' },
  { key: 'blocked', label: 'Bloqué' },
  { key: 'done', label: 'Terminé' },
  { key: 'overdue', label: 'En retard' },
];

const LIST_COLUMNS =
  'id, title, status, priority, deadline, completed_at, client_id, ' +
  'clients(name), ' +
  'task_assignments(employees(id, full_name, avatar_initials, avatar_color)), ' +
  'assignee:employees(id, full_name, avatar_initials, avatar_color)';

const DETAIL_COLUMNS =
  'id, title, description, status, priority, deadline, completed_at, client_id, video_id, created_at, updated_at, ' +
  'clients(name), ' +
  'task_assignments(employees(id, full_name, avatar_initials, avatar_color)), ' +
  'assignee:employees(id, full_name, avatar_initials, avatar_color)';

interface RawEmployee {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  avatar_color: string | null;
}

interface RawTaskRow {
  id: string;
  title: string;
  description?: string | null;
  video_id?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  completed_at: string | null;
  client_id: string | null;
  created_at?: string;
  updated_at?: string;
  clients: { name: string } | null;
  task_assignments: { employees: RawEmployee | null }[] | null;
  assignee: RawEmployee | null;
}

/** Pivot task_assignments first; legacy tasks.assignee_id as fallback. */
function resolveAssignees(row: RawTaskRow): TaskAssigneeInfo[] {
  const fromPivot = (row.task_assignments ?? [])
    .map((a) => a.employees)
    .filter((e): e is RawEmployee => e != null);
  const seen = new Set(fromPivot.map((e) => e.id));
  if (row.assignee && !seen.has(row.assignee.id)) {
    fromPivot.push(row.assignee);
  }
  return fromPivot;
}

function toListItem(row: RawTaskRow): TaskListItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    deadline: row.deadline,
    completed_at: row.completed_at,
    client_id: row.client_id,
    client_name: row.clients?.name ?? null,
    assignees: resolveAssignees(row),
  };
}

function applyFilter(query: any, filter: TaskFilter): any {
  switch (filter) {
    case 'all':
      return query.neq('status', 'archived');
    case 'blocked':
      // waiting_team is the legacy value of blocked (see web TASK_STATUS_MAP).
      return query.filter('status', 'in', '("blocked","waiting_team")');
    case 'overdue':
      return query
        .filter('status', 'not.in', '("done","archived")')
        .not('deadline', 'is', null)
        .lt('deadline', new Date().toISOString());
    default:
      return query.eq('status', filter);
  }
}

async function fetchTasks(filter: TaskFilter): Promise<TaskListItem[]> {
  let query = supabase.from('tasks').select(LIST_COLUMNS);
  query = applyFilter(query, filter);
  const { data, error } = await query
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawTaskRow[]).map(toListItem);
}

const LIKE_WILDCARD_RE = /[\\%_]/g;

/** Escapes LIKE wildcards so the user's text is matched literally. */
function escapeLike(term: string): string {
  return term.replace(LIKE_WILDCARD_RE, (m) => `\\${m}`);
}

function deadlineMs(t: TaskListItem): number {
  if (!t.deadline) return Infinity;
  const ms = new Date(t.deadline).getTime();
  return Number.isNaN(ms) ? Infinity : ms;
}

/**
 * Search across task title, client name and assignee name — all through
 * RLS-scoped, bounded queries (each ≤ 50 rows), merged and deduplicated.
 * Client/assignee matching goes through scoped lookups on `clients` /
 * `employees`, so a user can only ever match names RLS already lets them see.
 */
async function searchTasks(term: string, filter: TaskFilter): Promise<TaskListItem[]> {
  const pattern = `%${escapeLike(term.trim())}%`;
  const base = () => applyFilter(supabase.from('tasks').select(LIST_COLUMNS), filter);

  // Scoped name lookups (small, bounded).
  const [clientsRes, employeesRes] = await Promise.all([
    supabase.from('clients').select('id').ilike('name', pattern).limit(10),
    supabase.from('employees').select('id').ilike('full_name', pattern).limit(10),
  ]);
  if (clientsRes.error) throw new Error(clientsRes.error.message);
  if (employeesRes.error) throw new Error(employeesRes.error.message);
  const clientIds = (clientsRes.data ?? []).map((r) => r.id as string);
  const employeeIds = (employeesRes.data ?? []).map((r) => r.id as string);

  let assignedTaskIds: string[] = [];
  if (employeeIds.length > 0) {
    const { data, error } = await supabase
      .from('task_assignments')
      .select('task_id')
      .in('employee_id', employeeIds)
      .limit(100);
    if (error) throw new Error(error.message);
    assignedTaskIds = [...new Set((data ?? []).map((r) => r.task_id as string))];
  }

  const queries = [
    base().ilike('title', pattern).limit(50),
    clientIds.length > 0 ? base().in('client_id', clientIds).limit(50) : null,
    employeeIds.length > 0 ? base().in('assignee_id', employeeIds).limit(50) : null,
    assignedTaskIds.length > 0 ? base().in('id', assignedTaskIds).limit(50) : null,
  ].filter((q): q is NonNullable<typeof q> => q !== null);

  const results = await Promise.all(queries);
  const byId = new Map<string, TaskListItem>();
  for (const res of results) {
    if (res.error) throw new Error(res.error.message);
    for (const row of (res.data ?? []) as unknown as RawTaskRow[]) {
      if (!byId.has(row.id)) byId.set(row.id, toListItem(row));
    }
  }
  return [...byId.values()]
    .sort((a, b) => deadlineMs(a) - deadlineMs(b))
    .slice(0, 50);
}

export function useTasks(filter: TaskFilter, search = '') {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const term = search.trim();
      setTasks(term.length >= 2 ? await searchTasks(term, filter) : await fetchTasks(filter));
    } catch (e) {
      logDevError('useTasks', e);
      setError(toUserMessage(e));
    }
  }, [filter, search]);

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

  return { tasks, loading, refreshing, error, refresh, reload: load };
}

export function useTaskDetail(taskId: string | null) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!taskId) return;
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('tasks')
        .select(DETAIL_COLUMNS)
        .eq('id', taskId)
        .maybeSingle();
      if (err) throw new Error(err.message);
      if (!data) {
        setTask(null);
        setError('Tâche introuvable ou inaccessible.');
        return;
      }
      const row = data as unknown as RawTaskRow;

      // Linked video — separate RLS-scoped lookup: if the user can't see the
      // video, this returns nothing and the chip simply doesn't render.
      let linkedVideo: LinkedVideoInfo | null = null;
      if (row.video_id) {
        try {
          const { data: v } = await supabase
            .from('videos')
            .select('id, title, status')
            .eq('id', row.video_id)
            .maybeSingle();
          linkedVideo = (v as LinkedVideoInfo | null) ?? null;
        } catch {
          // non-blocking
        }
      }

      setTask({
        ...toListItem(row),
        description: row.description ?? null,
        video_id: row.video_id ?? null,
        linkedVideo,
        created_at: row.created_at ?? '',
        updated_at: row.updated_at ?? '',
      });
    } catch (e) {
      logDevError('useTaskDetail', e);
      setError(toUserMessage(e));
    }
  }, [taskId]);

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

  return { task, loading, error, reload: load };
}

export const RLS_DENIED_MSG = 'Vous n’avez pas l’autorisation de modifier cette tâche.';

/**
 * Statuses changeable from mobile. Deliberately excludes `blocked` and
 * `waiting_client`: on the web those transitions trigger notifications /
 * workflow side effects that mobile must not duplicate. Archive/delete are
 * out of scope entirely.
 */
export const SAFE_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

/**
 * Safe status change. Mirrors the web's updateTaskStatusAction patch
 * (src/app/(app)/tasks/actions.ts): status + updated_at, plus completed_at
 * when moving to done. The web never clears completed_at when leaving done,
 * so mobile doesn't either.
 * RLS (tasks_update_assigned_or_admin) is the enforcement: when the policy
 * rejects the row, PostgREST updates 0 rows — `.select('id')` detects that
 * and we surface a clean permission message instead of silently "succeeding".
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<{ error: string | null }> {
  if (!SAFE_STATUSES.includes(status)) {
    return { error: 'Statut non disponible sur mobile.' };
  }
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: nowIso };
  if (status === 'done') {
    patch.completed_at = nowIso;
  }
  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
    .select('id');
  if (error) {
    logDevError('updateTaskStatus', error);
    if (/policy|permission|denied/i.test(error.message)) {
      return { error: RLS_DENIED_MSG };
    }
    return { error: toUserMessage(error, 'La mise à jour a échoué. Réessayez.') };
  }
  if (!data || data.length === 0) {
    return { error: RLS_DENIED_MSG };
  }
  return { error: null };
}

/** Backwards-compatible helper used by the detail screen's primary button. */
export function markTaskDone(taskId: string): Promise<{ error: string | null }> {
  return updateTaskStatus(taskId, 'done');
}
