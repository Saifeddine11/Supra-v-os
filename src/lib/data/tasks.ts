import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import {
  shouldScopeTasksToAssignee,
  taskListingDenied,
} from '@/lib/auth/data-scope';
import { canManageAllTasks } from '@/lib/auth/capabilities';
import type { Task, TaskEnriched, TaskPriority, TaskStatus } from '@/types/database';
import {
  employeeHasTaskAssignment,
  fetchAssignmentsForTasks,
  fetchTaskIdsAssignedToEmployee,
  formatTaskAssigneeSummary,
  type TaskAssigneeRef,
} from '@/lib/data/task-assignments';
import { getClientColor } from '@/lib/ui/client-colors';
import {
  clampSearchInput,
  parseEnumParam,
  parseSafeIsoDate,
  parseUuidParam,
} from '@/lib/security/input-validation';
import { ALLOWED_TASK_PRIORITIES, ALLOWED_TASK_STATUSES } from '@/lib/security/query-whitelist';

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
  const taskIds = tasks.map((t) => t.id);
  const clientIds = [...new Set(tasks.map((t) => t.client_id).filter(Boolean))] as string[];
  const assignMap = await fetchAssignmentsForTasks(supabase, taskIds);

  const legacyEmpIds = [
    ...new Set(tasks.map((t) => t.assignee_id).filter(Boolean)),
  ] as string[];
  const allEmpIds = new Set<string>(legacyEmpIds);
  for (const arr of assignMap.values()) {
    arr.forEach((a) => allEmpIds.add(a.id));
  }

  const [clientsRes, empRes] = await Promise.all([
    clientIds.length
      ? supabase.from('clients').select('id, name, color_hex, color_label').in('id', clientIds)
      : Promise.resolve({
          data: [] as { id: string; name: string; color_hex: string | null; color_label: string | null }[],
        }),
    allEmpIds.size
      ? supabase.from('employees').select('id, full_name').in('id', [...allEmpIds])
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const clientRowMap = new Map((clientsRes.data ?? []).map((c) => [c.id, c]));
  const empMap = new Map((empRes.data ?? []).map((e) => [e.id, e.full_name]));

  return tasks.map((t) => {
    let assignees: TaskAssigneeRef[] = [...(assignMap.get(t.id) ?? [])];
    if (assignees.length === 0 && t.assignee_id) {
      assignees = [{ id: t.assignee_id, full_name: empMap.get(t.assignee_id) ?? '—' }];
    }
    const assignee_name = assignees.length ? formatTaskAssigneeSummary(assignees) : null;
    const crow = t.client_id ? clientRowMap.get(t.client_id) : undefined;
    return {
      ...t,
      assignees,
      assignee_name,
      client_name: crow?.name ?? null,
      client_brand_hex: crow ? getClientColor(crow) : null,
    };
  });
}

function orAssigneeAndPivot(assigneeFilterId: string, pivotTaskIds: string[]): string {
  const parts = [`assignee_id.eq.${assigneeFilterId}`];
  if (pivotTaskIds.length) parts.push(`id.in.(${pivotTaskIds.join(',')})`);
  return parts.join(',');
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
    const eid = auth.employee.id;
    const fromPivot = await fetchTaskIdsAssignedToEmployee(supabase, eid);
    q = q.or(orAssigneeAndPivot(eid, fromPivot));
  } else if (filters.assigneeId && filters.assigneeId !== 'all') {
    const assigneeUuid = parseUuidParam(filters.assigneeId);
    if (assigneeUuid) {
      const fromPivot = await fetchTaskIdsAssignedToEmployee(supabase, assigneeUuid);
      q = q.or(orAssigneeAndPivot(assigneeUuid, fromPivot));
    }
  }

  const priorityFilter = parseEnumParam(filters.priority, ALLOWED_TASK_PRIORITIES, 'all');
  if (priorityFilter !== 'all') {
    q = q.eq('priority', priorityFilter);
  }
  const statusFilter = parseEnumParam(filters.status, ALLOWED_TASK_STATUSES, 'all');
  if (statusFilter !== 'all') {
    q = q.eq('status', statusFilter);
  }
  if (filters.clientId && filters.clientId !== 'all') {
    const clientUuid = parseUuidParam(filters.clientId);
    if (clientUuid) q = q.eq('client_id', clientUuid);
  }
  const df = parseSafeIsoDate(filters.deadlineFrom);
  if (df) q = q.gte('deadline', df);
  const dt = parseSafeIsoDate(filters.deadlineTo);
  if (dt) q = q.lte('deadline', dt);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = data ?? [];

  const s = clampSearchInput(filters.search, 200).toLowerCase();
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
): Promise<TaskEnriched | null> {
  if (!parseUuidParam(id)) return null;
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !auth?.role) return null;
  if (taskListingDenied(auth)) return null;
  if (canManageAllTasks(auth.role)) {
    const [enriched] = await enrichTasks([data as Task]);
    return enriched ?? null;
  }
  if (shouldScopeTasksToAssignee(auth) && auth.employee) {
    const eid = auth.employee.id;
    if (data.assignee_id === eid) {
      const [enriched] = await enrichTasks([data as Task]);
      return enriched ?? null;
    }
    if (await employeeHasTaskAssignment(supabase, id, eid)) {
      const [enriched] = await enrichTasks([data as Task]);
      return enriched ?? null;
    }
    return null;
  }
  const [enriched] = await enrichTasks([data as Task]);
  return enriched ?? null;
}
