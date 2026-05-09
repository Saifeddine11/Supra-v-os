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
import { notifyTaskAssigned, notifyTaskBlocked } from '@/lib/notifications/task-events';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { requireAssignableEmployee } from '@/lib/data/employee-guards';

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
  let assigneeId = String(formData.get('assignee_id') ?? '').trim();
  const deadlineRaw = String(formData.get('deadline') ?? '').trim();

  if (clientId && !(await assertClientRecordVisible(supabase, ctx, clientId))) {
    return actionError('Client non autorisé pour cette tâche.');
  }

  if (shouldScopeTasksToAssignee(ctx) && ctx.employee) {
    if (assigneeId && assigneeId !== ctx.employee.id) {
      return actionError('Vous ne pouvez vous assigner des tâches qu’à vous-même.');
    }
    assigneeId = ctx.employee.id;
  }

  const assignCheck = await requireAssignableEmployee(supabase, assigneeId || null);
  if (!assignCheck.ok) return assignCheck;

  const row = {
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    client_id: clientId || null,
    assignee_id: assigneeId || null,
    status: (String(formData.get('status') ?? 'todo') || 'todo') as TaskStatus,
    priority: (String(formData.get('priority') ?? 'normal') || 'normal') as TaskPriority,
    deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
    created_by: user.id,
  };

  const { data, error } = await supabase.from('tasks').insert(row).select('id').single();
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'created',
    entityType: 'task',
    entityId: data.id,
    metadata: { title },
  });

  if (row.assignee_id) {
    await notifyTaskAssigned(row.assignee_id, data.id, title);
  }

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
  let assigneeId = String(formData.get('assignee_id') ?? '').trim();
  const deadlineRaw = String(formData.get('deadline') ?? '').trim();

  if (clientId && !(await assertClientRecordVisible(supabase, ctx, clientId))) {
    return actionError('Client non autorisé pour cette tâche.');
  }

  if (!canManageAllTasks(ctx.role) && ctx.employee) {
    if (assigneeId && assigneeId !== ctx.employee.id) {
      return actionError('Vous ne pouvez pas réattribuer cette tâche.');
    }
    assigneeId = ctx.employee.id;
  }

  const assignCheck = await requireAssignableEmployee(supabase, assigneeId || null);
  if (!assignCheck.ok) return assignCheck;

  const { data: prev } = await supabase.from('tasks').select('assignee_id').eq('id', id).maybeSingle();

  const { error } = await supabase
    .from('tasks')
    .update({
      title,
      description: String(formData.get('description') ?? '').trim() || null,
      client_id: clientId || null,
      assignee_id: assigneeId || null,
      status: String(formData.get('status') ?? 'todo') as TaskStatus,
      priority: String(formData.get('priority') ?? 'normal') as TaskPriority,
      deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'task',
    entityId: id,
    metadata: { title },
  });

  const nextAssignee = assigneeId || null;
  if (nextAssignee && nextAssignee !== (prev?.assignee_id ?? '')) {
    await notifyTaskAssigned(nextAssignee, id, title);
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
    const { data: t } = await supabase.from('tasks').select('assignee_id,title').eq('id', id).maybeSingle();
    if (t) await notifyTaskBlocked(t.assignee_id, id, t.title);
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
