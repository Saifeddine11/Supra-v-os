'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext, type AuthContext } from '@/lib/auth/permissions';
import { resolveTaskMutationClient } from '@/lib/auth/task-mutation-client';
import {
  canChangeTaskStatus,
  canCreateTasks,
  canDeleteTask,
  canManageAllTasks,
  canUpdateTasks,
} from '@/lib/auth/capabilities';
import {
  assertClientRecordVisible,
  assertTaskRecordVisible,
  taskListingDenied,
} from '@/lib/auth/data-scope';
import {
  assertAssigneesInSupervisionScope,
  resolveUpdatedTaskDepartment,
} from '@/lib/auth/supervision-server';
import { isDepartmentSupervisor } from '@/lib/auth/supervision';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { TaskDepartment, TaskEnriched, TaskPriority, TaskStatus } from '@/types/database';
import { isTaskStatusAllowedInWorkflow } from '@/types/domain';
import { createTaskCore } from '@/lib/tasks/create-task-core';
import { parseTaskDepartmentInput } from '@/lib/tasks/task-department';
import { notifyTaskAssignees, notifyTaskBlocked } from '@/lib/notifications/task-events';
import { peekTaskDiscordLink, scheduleTaskDiscordRemoved, scheduleTaskDiscordUpsert } from '@/lib/discord/task-discord';
import { scheduleTaskKanbanAdvancement } from '@/lib/discord/kanban-advancement';
import {
  isWaitingTeamValidationStatus,
  scheduleWaitingTeamValidationReminder,
} from '@/lib/discord/operational-reminders';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { requireAssignableEmployee } from '@/lib/data/employee-guards';
import { getTaskById } from '@/lib/data/tasks';
import {
  fetchAssignmentsForTasks,
  legacyPrimaryAssignee,
  replaceTaskAssignments,
} from '@/lib/data/task-assignments';
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

function assertActiveEmployee(ctx: AuthContext): ActionResult<never> | null {
  if (!ctx.employee) {
    return actionError('Profil employé introuvable : contactez un administrateur.');
  }
  if (!ctx.employee.is_active || ctx.employee.archived_at) {
    return actionError('Compte employé inactif : action désactivée.');
  }
  return null;
}

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
  if (!ctx.role) {
    return actionError(
      'Profil employé introuvable ou sans rôle : contactez un administrateur pour lier votre compte.',
    );
  }
  if (!canCreateTasks(ctx.role)) return actionError('Action non autorisée pour votre rôle.');
  if (taskListingDenied(ctx)) return actionError('Action non autorisée pour votre rôle.');

  const inactive = assertActiveEmployee(ctx);
  if (inactive) return inactive;

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le titre est requis.');

  const clientId = String(formData.get('client_id') ?? '').trim();
  const assigneeIds = parseAssigneeIdsFromForm(formData);
  const deadlineRaw = String(formData.get('deadline') ?? '').trim();
  const status = (String(formData.get('status') ?? 'todo') || 'todo') as TaskStatus;
  const departmentParsed = parseTaskDepartmentInput(formData.get('department'));
  if (!departmentParsed.ok) return actionError(departmentParsed.error);
  if (!departmentParsed.value) return actionError('Le département est requis.');

  return createTaskCore(ctx, {
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    clientId: clientId || null,
    assigneeIds,
    deadline: deadlineRaw || null,
    priority: (String(formData.get('priority') ?? 'normal') || 'normal') as TaskPriority,
    status,
    department: departmentParsed.value,
  });
}

export async function updateTaskAction(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  if (!canUpdateTasks(ctx.role)) return actionError('Action non autorisée pour votre rôle.');

  const inactive = assertActiveEmployee(ctx);
  if (inactive) return inactive;

  const readSb = await createClient();
  const writeSb = await resolveTaskMutationClient(ctx);

  if (!(await assertTaskRecordVisible(readSb, ctx, id))) {
    return actionError('Tâche inaccessible.');
  }

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le titre est requis.');

  const clientId = String(formData.get('client_id') ?? '').trim();
  let assigneeIds = parseAssigneeIdsFromForm(formData);
  const deadlineRaw = String(formData.get('deadline') ?? '').trim();

  const { data: curDeadlineRow } = await readSb
    .from('tasks')
    .select('deadline')
    .eq('id', id)
    .maybeSingle();
  if (deadlineRaw) {
    const deadlineCheck = validateOperationalFutureDate(deadlineRaw, {
      allowEmpty: false,
      mode: 'datetime',
      unchangedFrom: curDeadlineRow?.deadline ? String(curDeadlineRow.deadline) : null,
    });
    if (!deadlineCheck.ok) return actionError(deadlineCheck.message);
  }

  if (clientId && !(await assertClientRecordVisible(readSb, ctx, clientId))) {
    return actionError('Client non autorisé pour cette tâche.');
  }

  const { data: taskMeta } = await readSb.from('tasks').select('video_id').eq('id', id).maybeSingle();
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
  } else if (!canManageAllTasks(ctx.role) && !isDepartmentSupervisor(ctx.employee ?? ctx.role) && ctx.employee) {
    assigneeIds = [ctx.employee.id];
  }

  const { data: curTask } = await readSb
    .from('tasks')
    .select('assignee_id, status, department')
    .eq('id', id)
    .maybeSingle();

  const departmentParsed = parseTaskDepartmentInput(formData.get('department'));
  if (!departmentParsed.ok) return actionError(departmentParsed.error);
  const departmentResolved = resolveUpdatedTaskDepartment(
    ctx,
    departmentParsed.value,
    (curTask?.department as TaskDepartment | null) ?? null,
  );
  if (!departmentResolved.ok) return actionError(departmentResolved.error);

  const assigneeScope = await assertAssigneesInSupervisionScope(
    readSb,
    ctx,
    assigneeIds,
    departmentResolved.value,
  );
  if (assigneeScope) return assigneeScope;

  for (const aid of assigneeIds) {
    const assignCheck = await requireAssignableEmployee(readSb, aid);
    if (!assignCheck.ok) return assignCheck;
  }

  const prevMap = await fetchAssignmentsForTasks(readSb, [id]);
  const prevSet = new Set((prevMap.get(id) ?? []).map((a) => a.id));
  if (curTask?.assignee_id) prevSet.add(curTask.assignee_id as string);

  const primary = legacyPrimaryAssignee(assigneeIds);

  const status = (String(formData.get('status') ?? 'todo') || 'todo') as TaskStatus;
  if (!isTaskStatusAllowedInWorkflow(status)) {
    return actionError('Statut non disponible dans le workflow.');
  }

  const { error } = await writeSb
    .from('tasks')
    .update({
      title,
      description: String(formData.get('description') ?? '').trim() || null,
      client_id: clientId || null,
      assignee_id: primary.assignee_id,
      status,
      priority: String(formData.get('priority') ?? 'normal') as TaskPriority,
      department: departmentResolved.value,
      deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[updateTaskAction] update tasks:', error);
    return actionError(formatTaskMutationDbError(error));
  }

  try {
    await replaceTaskAssignments(writeSb, id, assigneeIds);
  } catch (e) {
    console.error('[updateTaskAction] task_assignments:', e);
    return actionError(formatTaskMutationDbError(e));
  }

  scheduleTaskDiscordUpsert(id);
  scheduleTaskKanbanAdvancement(id, curTask?.status as TaskStatus | undefined, status);
  if (isWaitingTeamValidationStatus(status) && !isWaitingTeamValidationStatus(curTask?.status as string | null)) {
    scheduleWaitingTeamValidationReminder(id);
  }

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'task',
    entityId: id,
    metadata: { title },
  });

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
  if (!canChangeTaskStatus(ctx.role)) return actionError('Action non autorisée pour votre rôle.');
  if (!isTaskStatusAllowedInWorkflow(status)) {
    return actionError('Statut non disponible dans le workflow.');
  }

  const readSb = await createClient();
  const writeSb = await resolveTaskMutationClient(ctx);

  if (!(await assertTaskRecordVisible(readSb, ctx, id))) {
    return actionError('Tâche inaccessible.');
  }

  const { data: currentStatusRow } = await readSb.from('tasks').select('status').eq('id', id).maybeSingle();

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'done') {
    patch.completed_at = new Date().toISOString();
  }

  const { error } = await writeSb.from('tasks').update(patch).eq('id', id);
  if (error) {
    console.error('[updateTaskStatusAction] update tasks:', error);
    return actionError(formatTaskMutationDbError(error));
  }

  scheduleTaskDiscordUpsert(id);
  scheduleTaskKanbanAdvancement(id, currentStatusRow?.status as TaskStatus | undefined, status);
  if (
    isWaitingTeamValidationStatus(status) &&
    !isWaitingTeamValidationStatus(currentStatusRow?.status as string | null)
  ) {
    scheduleWaitingTeamValidationReminder(id);
  }

  const { data: linkedVideo } = await readSb.from('tasks').select('video_id').eq('id', id).maybeSingle();

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'task',
    entityId: id,
    metadata: { status },
  });

  if (status === 'blocked') {
    const { data: t } = await readSb.from('tasks').select('title').eq('id', id).maybeSingle();
    const am = await fetchAssignmentsForTasks(readSb, [id]);
    const ids = (am.get(id) ?? []).map((a) => a.id);
    const { data: row } = await readSb.from('tasks').select('assignee_id').eq('id', id).maybeSingle();
    const all = new Set(ids);
    if (row?.assignee_id) all.add(row.assignee_id as string);
    await notifyTaskBlocked([...all], id, t?.title ?? 'Tâche');
  }

  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
  if (linkedVideo?.video_id) {
    revalidatePath('/videos');
  }
  return actionOk();
}

const TASK_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Deep-link alerte / lien interne — ouvre la fiche tâche si visible pour l'utilisateur. */
export async function getTaskEnrichedForHighlightAction(
  taskId: string,
): Promise<ActionResult<TaskEnriched>> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  const id = String(taskId ?? '').trim();
  if (!id || !TASK_UUID_RE.test(id)) return actionError('Identifiant tâche invalide.');
  try {
    const task = await getTaskById(id, ctx);
    if (!task) return actionError('Tâche introuvable ou accès non autorisé.');
    return actionOk(task);
  } catch {
    return actionError('Tâche introuvable ou accès non autorisé.');
  }
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canDeleteTask(ctx.role)) {
    return actionError('Seuls l’administrateur ou le chef de projet peuvent supprimer une tâche.');
  }

  const readSb = await createClient();
  const writeSb = await resolveTaskMutationClient(ctx);

  if (!(await assertTaskRecordVisible(readSb, ctx, id))) {
    return actionError('Tâche inaccessible.');
  }

  const { data: t } = await readSb.from('tasks').select('title').eq('id', id).maybeSingle();
  const discordLink = await peekTaskDiscordLink(id);
  const { error } = await writeSb.from('tasks').delete().eq('id', id);
  if (error) {
    console.error('[deleteTaskAction] delete tasks:', error);
    return actionError(formatTaskMutationDbError(error));
  }

  scheduleTaskDiscordRemoved(discordLink);

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
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  if (!canDeleteTask(ctx.role)) {
    return actionError('Seuls l’administrateur ou le chef de projet peuvent archiver une tâche.');
  }

  const inactive = assertActiveEmployee(ctx);
  if (inactive) return inactive;

  const readSb = await createClient();
  const writeSb = await resolveTaskMutationClient(ctx);

  if (!(await assertTaskRecordVisible(readSb, ctx, id))) {
    return actionError('Tâche inaccessible.');
  }

  const { data: current } = await readSb
    .from('tasks')
    .select('title, status, video_id')
    .eq('id', id)
    .maybeSingle();
  if (!current) return actionError('Tâche introuvable.');

  if (current.status === 'archived') {
    return actionOk();
  }

  const { error } = await writeSb
    .from('tasks')
    .update({
      status: 'archived' as TaskStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[archiveTaskAction] update tasks:', error);
    return actionError(formatTaskMutationDbError(error));
  }

  scheduleTaskDiscordUpsert(id);

  await logStaffActivity(ctx, {
    action: 'archived',
    entityType: 'task',
    entityId: id,
    metadata: { title: current.title, status: 'archived' },
  });

  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
  if (current.video_id) {
    revalidatePath('/videos');
  }
  return actionOk();
}
