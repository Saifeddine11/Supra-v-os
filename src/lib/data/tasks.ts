import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import {
  shouldScopeTasksToAssignee,
  taskListingDenied,
} from '@/lib/auth/data-scope';
import { canManageAllTasks } from '@/lib/auth/capabilities';
import type { Task, TaskEnriched, TaskPriority, TaskStatus } from '@/types/database';

export interface TaskListFilters {
  search?: string;
  assigneeId?: string | 'all';
  priority?: TaskPriority | 'all';
  status?: TaskStatus | 'all';
  deadlineFrom?: string;
  deadlineTo?: string;
  clientId?: string | 'all';
  /** Tâches liées à un client vs projet interne Supra. */
  projectScope?: 'all' | 'client' | 'internal';
}

async function enrichTasks(tasks: Task[]): Promise<TaskEnriched[]> {
  if (tasks.length === 0) return [];
  const supabase = await createClient();
  const clientIds = [...new Set(tasks.map((t) => t.client_id).filter(Boolean))] as string[];
  const assigneeIds = [...new Set(tasks.map((t) => t.assignee_id).filter(Boolean))] as string[];

  const [clientsRes, empRes] = await Promise.all([
    clientIds.length
      ? supabase.from('clients').select('id, name').in('id', clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    assigneeIds.length
      ? supabase.from('employees').select('id, full_name').in('id', assigneeIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const clientMap = new Map((clientsRes.data ?? []).map((c) => [c.id, c.name]));
  const empMap = new Map((empRes.data ?? []).map((e) => [e.id, e.full_name]));

  return tasks.map((t) => ({
    ...t,
    assignee_name: t.assignee_id ? (empMap.get(t.assignee_id) ?? null) : null,
    client_name: t.client_id ? (clientMap.get(t.client_id) ?? null) : null,
  }));
}

export async function listTasks(
  filters: TaskListFilters = {},
  ctx: AuthContext | null = null
): Promise<Task[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();

  if (!auth?.role || taskListingDenied(auth)) return [];

  let q = supabase
    .from('tasks')
    .select('*')
    .neq('status', 'archived')
    .order('deadline', { ascending: true, nullsFirst: false });

  if (shouldScopeTasksToAssignee(auth) && auth.employee) {
    q = q.eq('assignee_id', auth.employee.id);
  } else if (filters.assigneeId && filters.assigneeId !== 'all') {
    q = q.eq('assignee_id', filters.assigneeId);
  }

  if (filters.priority && filters.priority !== 'all') {
    q = q.eq('priority', filters.priority);
  }
  if (filters.status && filters.status !== 'all') {
    q = q.eq('status', filters.status);
  }
  if (filters.clientId && filters.clientId !== 'all') {
    q = q.eq('client_id', filters.clientId);
  }
  if (filters.deadlineFrom) {
    q = q.gte('deadline', filters.deadlineFrom);
  }
  if (filters.deadlineTo) {
    q = q.lte('deadline', filters.deadlineTo);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = data ?? [];

  const s = filters.search?.trim().toLowerCase();
  if (s) {
    rows = rows.filter(
      (t) =>
        t.title.toLowerCase().includes(s) || (t.description?.toLowerCase().includes(s) ?? false)
    );
  }

  if (filters.projectScope === 'client') {
    rows = rows.filter((t) => Boolean(t.client_id));
  } else if (filters.projectScope === 'internal') {
    rows = rows.filter((t) => Boolean(t.internal_project_id));
  }

  return rows;
}

export async function listTasksEnriched(
  filters: TaskListFilters = {},
  ctx: AuthContext | null = null
): Promise<TaskEnriched[]> {
  const tasks = await listTasks(filters, ctx);
  return enrichTasks(tasks);
}

export async function getTaskById(
  id: string,
  ctx: AuthContext | null = null
): Promise<Task | null> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !auth?.role) return null;
  if (taskListingDenied(auth)) return null;
  if (canManageAllTasks(auth.role)) return data;
  if (shouldScopeTasksToAssignee(auth) && auth.employee && data.assignee_id === auth.employee.id) {
    return data;
  }
  return null;
}
