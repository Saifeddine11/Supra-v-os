import 'server-only';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { type AuthContext } from '@/lib/auth/permissions';
import { resolveTaskMutationClient } from '@/lib/auth/task-mutation-client';
import {
  canCreateTasks,
} from '@/lib/auth/capabilities';
import {
  assertClientRecordVisible,
  shouldScopeTasksToAssignee,
  taskListingDenied,
} from '@/lib/auth/data-scope';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { TaskDepartment, TaskPriority, TaskStatus } from '@/types/database';
import { isTaskStatusAllowedInWorkflow } from '@/types/domain';
import { notifyTaskAssignees } from '@/lib/notifications/task-events';
import { scheduleTaskDiscordUpsert } from '@/lib/discord/task-discord';
import {
  isWaitingTeamValidationStatus,
  scheduleWaitingTeamValidationReminder,
} from '@/lib/discord/operational-reminders';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { requireAssignableEmployee } from '@/lib/data/employee-guards';
import {
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

export type CreateTaskCoreInput = {
  title: string;
  description?: string | null;
  clientId?: string | null;
  assigneeIds?: string[];
  deadline?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  department?: TaskDepartment | null;
};

export async function createTaskCore(
  ctx: AuthContext,
  input: CreateTaskCoreInput,
): Promise<ActionResult<{ id: string }>> {
  if (!ctx.role) {
    return actionError(
      'Profil employé introuvable ou sans rôle : contactez un administrateur pour lier votre compte.',
    );
  }
  if (!canCreateTasks(ctx.role)) return actionError('Action non autorisée pour votre rôle.');
  if (taskListingDenied(ctx)) return actionError('Action non autorisée pour votre rôle.');

  const inactive = assertActiveEmployee(ctx);
  if (inactive) return inactive;

  const readSb = await createClient();
  const writeSb = await resolveTaskMutationClient(ctx);
  const {
    data: { user },
  } = await readSb.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const title = input.title.trim();
  if (!title) return actionError('Le titre est requis.');

  const clientId = (input.clientId ?? '').trim();
  let assigneeIds = dedupeIds(input.assigneeIds ?? []);
  const deadlineRaw = (input.deadline ?? '').trim();
  if (deadlineRaw) {
    const deadlineCheck = validateOperationalFutureDate(deadlineRaw, {
      allowEmpty: false,
      mode: 'datetime',
    });
    if (!deadlineCheck.ok) return actionError(deadlineCheck.message);
  }

  if (clientId && !(await assertClientRecordVisible(readSb, ctx, clientId))) {
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
    const assignCheck = await requireAssignableEmployee(readSb, aid);
    if (!assignCheck.ok) return assignCheck;
  }

  const primary = legacyPrimaryAssignee(assigneeIds);

  const status = (input.status ?? 'todo') as TaskStatus;
  if (!isTaskStatusAllowedInWorkflow(status)) {
    return actionError('Statut non disponible dans le workflow.');
  }

  const row = {
    title,
    description: (input.description ?? '').trim() || null,
    client_id: clientId || null,
    assignee_id: primary.assignee_id,
    status,
    priority: (input.priority ?? 'normal') as TaskPriority,
    department: input.department ?? null,
    deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
    created_by: user.id,
  };

  const { data, error } = await writeSb.from('tasks').insert(row).select('id').single();
  if (error) {
    console.error('[createTaskCore] insert tasks:', error);
    return actionError(formatTaskMutationDbError(error));
  }

  try {
    await replaceTaskAssignments(writeSb, data.id, assigneeIds);
  } catch (e) {
    await writeSb.from('tasks').delete().eq('id', data.id);
    console.error('[createTaskCore] task_assignments:', e);
    return actionError(formatTaskMutationDbError(e));
  }

  scheduleTaskDiscordUpsert(data.id);
  if (isWaitingTeamValidationStatus(status)) {
    scheduleWaitingTeamValidationReminder(data.id);
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
