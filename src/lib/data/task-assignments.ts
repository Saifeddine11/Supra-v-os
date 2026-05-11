import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

type SB = SupabaseClient;

export type TaskAssigneeRef = { id: string; full_name: string };

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
}

export async function fetchTaskIdsAssignedToEmployee(sb: SB, employeeId: string): Promise<string[]> {
  const { data, error } = await sb.from('task_assignments').select('task_id').eq('employee_id', employeeId);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.task_id as string))];
}

export async function employeeHasTaskAssignment(
  sb: SB,
  taskId: string,
  employeeId: string,
): Promise<boolean> {
  const { data, error } = await sb
    .from('task_assignments')
    .select('id')
    .eq('task_id', taskId)
    .eq('employee_id', employeeId)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function fetchAssignmentsForTasks(
  sb: SB,
  taskIds: string[],
): Promise<Map<string, TaskAssigneeRef[]>> {
  const out = new Map<string, TaskAssigneeRef[]>();
  if (taskIds.length === 0) return out;
  for (const id of taskIds) out.set(id, []);

  const { data, error } = await sb.from('task_assignments').select('task_id, employee_id').in('task_id', taskIds);
  if (error) throw new Error(error.message);
  const empIds = [...new Set((data ?? []).map((r) => r.employee_id as string).filter(Boolean))];
  const nameMap = new Map<string, string>();
  if (empIds.length > 0) {
    const { data: emps, error: e2 } = await sb.from('employees').select('id, full_name').in('id', empIds);
    if (e2) throw new Error(e2.message);
    for (const e of emps ?? []) nameMap.set(e.id as string, String((e as { full_name: string }).full_name));
  }
  for (const row of data ?? []) {
    const tid = row.task_id as string;
    const eid = row.employee_id as string;
    const bucket = out.get(tid);
    if (!bucket) continue;
    bucket.push({ id: eid, full_name: nameMap.get(eid) ?? '—' });
  }
  for (const [, arr] of out) {
    arr.sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr', { sensitivity: 'base' }));
  }
  return out;
}

export async function replaceTaskAssignments(sb: SB, taskId: string, employeeIds: string[]): Promise<void> {
  const ids = dedupeIds(employeeIds);
  const { error: delErr } = await sb.from('task_assignments').delete().eq('task_id', taskId);
  if (delErr) throw new Error(delErr.message);
  if (ids.length === 0) return;
  const rows = ids.map((employee_id) => ({ task_id: taskId, employee_id }));
  const { error: insErr } = await sb.from('task_assignments').insert(rows);
  if (insErr) throw new Error(insErr.message);
}

export function legacyPrimaryAssignee(employeeIds: string[]) {
  return { assignee_id: employeeIds[0] ?? null };
}

/** Libellé carte / liste : « Nom, Nom » ou « Premier + N autres ». */
export function formatTaskAssigneeSummary(people: TaskAssigneeRef[], maxNames = 2): string {
  if (people.length === 0) return '';
  if (people.length <= maxNames) return people.map((p) => p.full_name).join(', ');
  const head = people.slice(0, maxNames).map((p) => p.full_name).join(', ');
  const rest = people.length - maxNames;
  return `${head} +${rest}`;
}
