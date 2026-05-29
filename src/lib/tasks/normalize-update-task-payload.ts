import 'server-only';

import type { AuthContext } from '@/lib/auth/permissions';
import { actionError, type ActionResult } from '@/lib/actions/types';
import type { AiUpdateTaskInput } from '@/lib/ai/task-update-draft-schema';
import {
  resolveAssigneeForTask,
  resolveClientForTask,
} from '@/lib/tasks/resolve-task-references';
import type { UpdateTaskCoreInput } from '@/lib/tasks/update-task-core';
import type { TaskPriority, TaskStatus } from '@/types/database';

export type NormalizeUpdateTaskResult = ActionResult<UpdateTaskCoreInput>;

export async function normalizeUpdateTaskPayload(
  ctx: AuthContext,
  input: AiUpdateTaskInput,
): Promise<NormalizeUpdateTaskResult> {
  const { taskId, changes } = input;
  const patch: UpdateTaskCoreInput = { taskId };

  if (changes.title !== undefined) {
    const title = changes.title.trim();
    if (!title) return actionError('Le titre ne peut pas être vide.');
    patch.title = title;
  }

  if (changes.description !== undefined) {
    patch.description = changes.description?.trim() || null;
  }

  if (changes.deadline !== undefined) {
    patch.deadline = changes.deadline;
  }

  if (changes.priority !== undefined) {
    patch.priority = changes.priority as TaskPriority;
  }

  if (changes.status !== undefined) {
    patch.status = changes.status as TaskStatus;
  }

  if (changes.clientId || changes.clientName) {
    const clientResolved = await resolveClientForTask(
      ctx,
      changes.clientId,
      changes.clientName,
    );
    if (!clientResolved.ok) return clientResolved;
    patch.clientId = clientResolved.data!.id;
  }

  if (changes.assigneeIds?.length || changes.assigneeName) {
    const assigneeResolved = await resolveAssigneeForTask(
      ctx,
      changes.assigneeIds,
      changes.assigneeName,
    );
    if (!assigneeResolved.ok) return assigneeResolved;
    patch.assigneeIds = assigneeResolved.data!.ids;
  }

  const hasPatch =
    patch.title !== undefined ||
    patch.description !== undefined ||
    patch.deadline !== undefined ||
    patch.priority !== undefined ||
    patch.status !== undefined ||
    patch.clientId !== undefined ||
    patch.assigneeIds !== undefined;

  if (!hasPatch) {
    return actionError('Au moins une modification est requise.');
  }

  return { ok: true, data: patch };
}
