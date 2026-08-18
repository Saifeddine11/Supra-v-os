import 'server-only';

import type { AuthContext } from '@/lib/auth/permissions';
import { resolveTaskMutationClient } from '@/lib/auth/task-mutation-client';
import { canManageAllTasks } from '@/lib/auth/capabilities';
import {
  assertClientRecordVisible,
  assertTaskRecordVisible,
} from '@/lib/auth/data-scope';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import { createClient } from '@/lib/supabase/server';
import { requireAssignableEmployee } from '@/lib/data/employee-guards';
import {
  fetchAssignmentsForTasks,
  legacyPrimaryAssignee,
  replaceTaskAssignments,
} from '@/lib/data/task-assignments';
import { getTaskById } from '@/lib/data/tasks';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { notifyTaskAssignees, notifyTaskBlocked } from '@/lib/notifications/task-events';
import { scheduleTaskDiscordUpsert } from '@/lib/discord/task-discord';
import type { TaskPriority, TaskStatus } from '@/types/database';
import { isTaskStatusAllowedInWorkflow } from '@/types/domain';
import { revalidatePath } from 'next/cache';
import { validateOperationalFutureDate } from '@/lib/dates/validate-future-date';

const TASK_MUTATION_DENIED =
  'Action impossible : vous n’avez pas l’autorisation ou la tâche est invalide.';

function formatTaskMutationDbError(err: unknown): string {
  const raw =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : getPostgrestError(err);
  const lower = raw.toLowerCase();
  if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('permission denied')) {
    return TASK_MUTATION_DENIED;
  }
  return raw;
}

export type UpdateTaskCoreInput = {
  taskId: string;
  title?: string;
  description?: string | null;
  clientId?: string | null;
  assigneeIds?: string[];
  deadline?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
};

export async function updateTaskCore(
  ctx: AuthContext,
  input: UpdateTaskCoreInput,
): Promise<ActionResult<{ id: string }>> {
  if (!ctx.role || !canManageAllTasks(ctx.role)) {
    return actionError('Action non autorisée pour votre rôle.');
  }
  if (!ctx.employee?.is_active || ctx.employee.archived_at) {
    return actionError('Compte employé inactif : action désactivée.');
  }

  const readSb = await createClient();
  const writeSb = await resolveTaskMutationClient(ctx);
  const taskId = input.taskId.trim();

  if (!(await assertTaskRecordVisible(readSb, ctx, taskId))) {
    return actionError('Tâche inaccessible.');
  }

  const current = await getTaskById(taskId, ctx);
  if (!current) return actionError('Tâche introuvable.');

  const title = input.title?.trim() ?? current.title;
  if (!title) return actionError('Le titre est requis.');

  const clientId =
    input.clientId !== undefined ? input.clientId || null : current.client_id;
  if (clientId && !(await assertClientRecordVisible(readSb, ctx, clientId))) {
    return actionError('Client non autorisé pour cette tâche.');
  }

  let assigneeIds =
    input.assigneeIds !== undefined
      ? [...new Set(input.assigneeIds.map((x) => x.trim()).filter(Boolean))]
      : (current.assignees ?? []).map((a) => a.id);

  const { data: taskMeta } = await readSb.from('tasks').select('video_id').eq('id', taskId).maybeSingle();
  if (taskMeta?.video_id) {
    const vid = taskMeta.video_id as string;
    const { data: va } = await readSb.from('video_assignments').select('employee_id').eq('video_id', vid);
    const { data: vrow } = await readSb.from('videos').select('editor_id,cameraman_id').eq('id', vid).maybeSingle();
    const s = new Set<string>();
    for (const r of va ?? []) {
      if (r.employee_id) s.add(r.employee_id as string);
    }
    if (vrow?.editor_id) s.add(vrow.editor_id as string);
    if (vrow?.cameraman_id) s.add(vrow.cameraman_id as string);
    assigneeIds = [...s];
  }

  for (const aid of assigneeIds) {
    const assignCheck = await requireAssignableEmployee(readSb, aid);
    if (!assignCheck.ok) return assignCheck;
  }

  const prevMap = await fetchAssignmentsForTasks(readSb, [taskId]);
  const prevSet = new Set((prevMap.get(taskId) ?? []).map((a) => a.id));
  if (current.assignee_id) prevSet.add(current.assignee_id);

  const status = (input.status ?? current.status) as TaskStatus;
  if (!isTaskStatusAllowedInWorkflow(status)) {
    return actionError('Statut non disponible dans le workflow.');
  }

  const priority = (input.priority ?? current.priority) as TaskPriority;
  let deadline: string | null =
    input.deadline !== undefined
      ? input.deadline
        ? new Date(input.deadline).toISOString()
        : null
      : current.deadline;

  if (input.deadline !== undefined && input.deadline) {
    const deadlineCheck = validateOperationalFutureDate(input.deadline, {
      allowEmpty: false,
      mode: 'datetime',
      unchangedFrom: current.deadline,
    });
    if (!deadlineCheck.ok) return actionError(deadlineCheck.message);
  }
  const description =
    input.description !== undefined ? input.description : current.description;

  const primary = legacyPrimaryAssignee(assigneeIds);

  const patch: Record<string, unknown> = {
    title,
    description: description?.trim() || null,
    client_id: clientId,
    assignee_id: primary.assignee_id,
    status,
    priority,
    deadline,
    updated_at: new Date().toISOString(),
  };
  if (status === 'done') {
    patch.completed_at = new Date().toISOString();
  }

  const { error } = await writeSb.from('tasks').update(patch).eq('id', taskId);
  if (error) {
    console.error('[updateTaskCore] update tasks:', error);
    return actionError(formatTaskMutationDbError(error));
  }

  try {
    await replaceTaskAssignments(writeSb, taskId, assigneeIds);
  } catch (e) {
    console.error('[updateTaskCore] task_assignments:', e);
    return actionError(formatTaskMutationDbError(e));
  }

  scheduleTaskDiscordUpsert(taskId);

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'task',
    entityId: taskId,
    metadata: { title, via: 'supai' },
  });

  const newly = assigneeIds.filter((eid) => !prevSet.has(eid));
  if (newly.length) {
    await notifyTaskAssignees(newly, taskId, title);
  }

  if (status === 'blocked') {
    const all = new Set(assigneeIds);
    await notifyTaskBlocked([...all], taskId, title);
  }

  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
  if (taskMeta?.video_id) {
    revalidatePath('/videos');
  }

  return actionOk({ id: taskId });
}
