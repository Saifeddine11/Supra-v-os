'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canDeleteTask, canManageAllTasks } from '@/lib/auth/capabilities';
import {
  assertClientRecordVisible,
  assertTaskRecordVisible,
  shouldScopeTasksToAssignee,
  taskListingDenied,
} from '@/lib/auth/data-scope';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { TaskPriority, TaskStatus } from '@/types/database';
import { notifyTaskAssignees, notifyTaskBlocked } from '@/lib/notifications/task-events';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { requireAssignableEmployee } from '@/lib/data/employee-guards';
import {
  fetchAssignmentsForTasks,
  legacyPrimaryAssignee,
  replaceTaskAssignments,
} from '@/lib/data/task-assignments';

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
}

function parseJsonIdArray(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  const t = raw.trim();
  if (!t) return [];
  try {
    const arr = JSON.parse(t) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function parseAssigneeIdsFromForm(formData: FormData): string[] {
  let ids = dedupeIds(parseJsonIdArray(formData.get('assignee_ids')));
  if (ids.length === 0) {
    const leg = String(formData.get('assignee_id') ?? '').trim();
    if (leg) ids = [leg];
  }
  return ids;
}

export async function createTaskAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  if (taskListingDenied(ctx)) return actionError('Action non autorisée pour votre rôle.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le titre est requis.');

  const clientId = String(formData.get('client_id') ?? '').trim();
  let assigneeIds = parseAssigneeIdsFromForm(formData);
  const deadlineRaw = String(formData.get('deadline') ?? '').trim();

  if (clientId && !(await assertClientRecordVisible(supabase, ctx, clientId))) {
    return actionError('Client non autorisé pour cette tâche.');
  }

  if (shouldScopeTasksToAssignee(ctx) && ctx.employee) {
    const eid = ctx.employee.id;
    if (assigneeIds.some((id) => id && id !== eid)) {
      return actionError('Vous ne pouvez vous assigner des tâches qu’à vous-même.');
    }
    if (assigneeIds.length === 0) assigneeIds = [eid];
  }

  for (const aid of assigneeIds) {
    const assignCheck = await requireAssignableEmployee(supabase, aid);
    if (!assignCheck.ok) return assignCheck;
  }

  const primary = legacyPrimaryAssignee(assigneeIds);

  const row = {
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    client_id: clientId || null,
    assignee_id: primary.assignee_id,
    status: (String(formData.get('status') ?? 'todo') || 'todo') as TaskStatus,
    priority: (String(formData.get('priority') ?? 'normal') || 'normal') as TaskPriority,
    deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
    created_by: user.id,
  };

  const { data, error } = await supabase.from('tasks').insert(row).select('id').single();
  if (error) return actionError(getPostgrestError(error));

  try {
    await replaceTaskAssignments(supabase, data.id, assigneeIds);
  } catch (e) {
    await supabase.from('tasks').delete().eq('id', data.id);
    return actionError(e instanceof Error ? e.message : 'Assignations invalides.');
  }

  await logStaffActivity(ctx, {
    action: 'created',
    entityType: 'task',
    entityId: data.id,
    metadata: { title },
  });

  await notifyTaskAssignees(assigneeIds, data.id, title);

  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
  return actionOk({ id: data.id });
}

export async function updateTaskAction(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');

  const supabase = await createClient();
  if (!(await assertTaskRecordVisible(supabase, ctx, id))) {
    return actionError('Tâche inaccessible.');
  }

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le titre est requis.');

  const clientId = String(formData.get('client_id') ?? '').trim();
  let assigneeIds = parseAssigneeIdsFromForm(formData);
  const deadlineRaw = String(formData.get('deadline') ?? '').trim();

  if (clientId && !(await assertClientRecordVisible(supabase, ctx, clientId))) {
    return actionError('Client non autorisé pour cette tâche.');
  }

  const { data: taskMeta } = await supabase.from('tasks').select('video_id').eq('id', id).maybeSingle();
  if (taskMeta?.video_id) {
    const vid = taskMeta.video_id as string;
    const { data: va } = await supabase.from('video_assignments').select('employee_id').eq('video_id', vid);
    const { data: vrow } = await supabase.from('videos').select('editor_id,cameraman_id').eq('id', vid).maybeSingle();
    const s = new Set<string>();
    for (const r of va ?? []) {
      if (r.employee_id) s.add(r.employee_id as string);
    }
    if (vrow?.editor_id) s.add(vrow.editor_id as string);
    if (vrow?.cameraman_id) s.add(vrow.cameraman_id as string);
    assigneeIds = [...s];
  } else if (!canManageAllTasks(ctx.role) && ctx.employee) {
    assigneeIds = [ctx.employee.id];
  }

  for (const aid of assigneeIds) {
    const assignCheck = await requireAssignableEmployee(supabase, aid);
    if (!assignCheck.ok) return assignCheck;
  }

  const prevMap = await fetchAssignmentsForTasks(supabase, [id]);
  const prevSet = new Set((prevMap.get(id) ?? []).map((a) => a.id));
  const { data: curTask } = await supabase.from('tasks').select('assignee_id').eq('id', id).maybeSingle();
  if (curTask?.assignee_id) prevSet.add(curTask.assignee_id as string);

  const primary = legacyPrimaryAssignee(assigneeIds);

  const { error } = await supabase
    .from('tasks')
    .update({
      title,
      description: String(formData.get('description') ?? '').trim() || null,
      client_id: clientId || null,
      assignee_id: primary.assignee_id,
      status: String(formData.get('status') ?? 'todo') as TaskStatus,
      priority: String(formData.get('priority') ?? 'normal') as TaskPriority,
      deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return actionError(getPostgrestError(error));

  try {
    await replaceTaskAssignments(supabase, id, assigneeIds);
  } catch (e) {
    return actionError(e instanceof Error ? e.message : 'Échec mise à jour des assignations.');
  }

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'task',
    entityId: id,
    metadata: { title },
  });

  const nextSet = new Set(assigneeIds);
  const newly = assigneeIds.filter((eid) => !prevSet.has(eid));
  if (newly.length) {
    await notifyTaskAssignees(newly, id, title);
  }

  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
  return actionOk();
}

export async function updateTaskStatusAction(id: string, status: TaskStatus): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');

  const supabase = await createClient();
  if (!(await assertTaskRecordVisible(supabase, ctx, id))) {
    return actionError('Tâche inaccessible.');
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'done') {
    patch.completed_at = new Date().toISOString();
  }

  const { error } = await supabase.from('tasks').update(patch).eq('id', id);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'task',
    entityId: id,
    metadata: { status },
  });

  if (status === 'blocked') {
    const { data: t } = await supabase.from('tasks').select('title').eq('id', id).maybeSingle();
    const am = await fetchAssignmentsForTasks(supabase, [id]);
    const ids = (am.get(id) ?? []).map((a) => a.id);
    const { data: row } = await supabase.from('tasks').select('assignee_id').eq('id', id).maybeSingle();
    const all = new Set(ids);
    if (row?.assignee_id) all.add(row.assignee_id as string);
    await notifyTaskBlocked([...all], id, t?.title ?? 'Tâche');
  }

  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
  return actionOk();
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canDeleteTask(ctx.role)) {
    return actionError('Seuls l’administrateur ou le chef de projet peuvent supprimer une tâche.');
  }

  const supabase = await createClient();
  if (!(await assertTaskRecordVisible(supabase, ctx, id))) {
    return actionError('Tâche inaccessible.');
  }

  const { data: t } = await supabase.from('tasks').select('title').eq('id', id).maybeSingle();
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'deleted',
    entityType: 'task',
    entityId: id,
    metadata: { title: t?.title },
  });

  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
  return actionOk();
}

export async function archiveTaskAction(id: string): Promise<ActionResult> {
  return updateTaskStatusAction(id, 'archived');
}
