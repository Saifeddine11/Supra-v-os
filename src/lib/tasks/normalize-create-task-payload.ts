import 'server-only';

import type { AuthContext } from '@/lib/auth/permissions';
import { actionError, actionOk, type ActionResult } from '@/lib/actions/types';
import { parseFrenchDeadlineText } from '@/lib/ai/parse-task-deadline';
import { validateOperationalFutureIso } from '@/lib/dates/validate-future-date';
import type { CreateTaskCoreInput } from '@/lib/tasks/create-task-core';
import {
  resolveAssigneeForTask,
  resolveClientForTask,
} from '@/lib/tasks/resolve-task-references';
import type { TaskPriority, TaskStatus } from '@/types/database';

/** Same shape as manual task form submission (names optional for server resolution). */
export type CreateTaskFormInput = {
  title: string;
  description?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  assigneeIds?: string[];
  assigneeName?: string | null;
  deadline?: string | null;
  deadlineText?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
};

function resolveDeadline(deadline?: string | null, deadlineText?: string | null): string | null {
  const iso = deadline?.trim();
  if (iso && !Number.isNaN(Date.parse(iso))) {
    return new Date(iso).toISOString();
  }
  if (deadlineText?.trim()) {
    const parsed = parseFrenchDeadlineText(deadlineText);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * Resolve names → IDs and build the exact payload used by manual task creation.
 * Blocks silent unassigned / unlinked client when names were provided.
 */
export async function normalizeCreateTaskPayload(
  ctx: AuthContext,
  input: CreateTaskFormInput,
): Promise<ActionResult<CreateTaskCoreInput>> {
  const title = input.title.trim();
  if (!title) return actionError('Le titre est requis.');

  let clientId = input.clientId?.trim() || null;
  const clientName = input.clientName?.trim();

  if (!clientId && clientName) {
    const clientResolved = await resolveClientForTask(ctx, null, clientName);
    if (!clientResolved.ok) return clientResolved;
    clientId = clientResolved.data!.id;
  }

  let assigneeIds = [...new Set((input.assigneeIds ?? []).map((x) => x.trim()).filter(Boolean))];
  const assigneeName = input.assigneeName?.trim();

  if (assigneeIds.length === 0 && assigneeName) {
    const assigneeResolved = await resolveAssigneeForTask(ctx, [], assigneeName);
    if (!assigneeResolved.ok) return assigneeResolved;
    assigneeIds = assigneeResolved.data!.ids;
  }

  if (assigneeName && assigneeIds.length === 0) {
    return actionError(`Assigné introuvable : ${assigneeName}`);
  }

  if (clientName && !clientId) {
    return actionError(`Client introuvable : ${clientName}`);
  }

  const deadline = resolveDeadline(input.deadline, input.deadlineText);
  if (deadline) {
    const deadlineCheck = validateOperationalFutureIso(deadline, { allowEmpty: false });
    if (!deadlineCheck.ok) return actionError(deadlineCheck.message);
  }

  return actionOk({
    title,
    description: input.description?.trim() || null,
    clientId,
    assigneeIds,
    deadline,
    priority: (input.priority ?? 'normal') as TaskPriority,
    status: (input.status ?? 'todo') as TaskStatus,
  });
}
