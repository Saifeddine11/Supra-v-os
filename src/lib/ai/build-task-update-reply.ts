import 'server-only';

import type { AiTaskUpdateDraftPayload } from '@/lib/ai/task-update-draft-schema';
import {
  TASK_UPDATE_DRAFT_CONFIRM_REPLY,
  TASK_UPDATE_DRAFT_EMPTY_CHANGES,
  TASK_UPDATE_DRAFT_NOT_FOUND,
} from '@/lib/ai/supai-copy';
import { hasTaskUpdateChanges } from '@/lib/ai/task-update-draft-schema';
import type { AuthContext } from '@/lib/auth/permissions';
import { lookupTaskForUpdate } from '@/lib/tasks/resolve-task-for-update';
import {
  previewClientResolution,
  previewAssigneeResolution,
} from '@/lib/tasks/resolve-task-references';
import { isPastOperationalDateTime, SUPAI_PAST_DATE_REFUSAL } from '@/lib/dates/validate-future-date';

export async function buildTaskUpdateDraftReply(
  ctx: AuthContext,
  draft: AiTaskUpdateDraftPayload,
): Promise<string> {
  if (!hasTaskUpdateChanges(draft.changes)) {
    return TASK_UPDATE_DRAFT_EMPTY_CHANGES;
  }

  if (
    draft.changes.deadlineIso?.trim() &&
    !draft.changes.clearDeadline &&
    isPastOperationalDateTime(draft.changes.deadlineIso)
  ) {
    return SUPAI_PAST_DATE_REFUSAL;
  }

  const lookup = await lookupTaskForUpdate(ctx, {
    taskId: draft.taskId,
    taskSearchText: draft.taskSearchText,
  });

  if (lookup.status === 'not_found') {
    return TASK_UPDATE_DRAFT_NOT_FOUND;
  }

  if (lookup.status === 'ambiguous') {
    return `${TASK_UPDATE_DRAFT_CONFIRM_REPLY} Plusieurs tâches correspondent — choisissez la bonne fiche avant de confirmer.`;
  }

  let incomplete = false;

  if (draft.changes.deadlineText?.trim() && !draft.changes.deadlineIso && !draft.changes.clearDeadline) {
    incomplete = true;
  }

  if (draft.changes.clientName?.trim()) {
    const preview = await previewClientResolution(ctx, draft.changes.clientName);
    if (preview.status === 'not_found' || preview.status === 'ambiguous') {
      incomplete = true;
    }
  }

  if (draft.changes.assigneeName?.trim()) {
    const preview = await previewAssigneeResolution(ctx, draft.changes.assigneeName);
    if (preview.status === 'not_found' || preview.status === 'ambiguous') {
      incomplete = true;
    }
  }

  if (incomplete) {
    return `${TASK_UPDATE_DRAFT_CONFIRM_REPLY} Certaines informations doivent être complétées ou clarifiées.`;
  }

  return TASK_UPDATE_DRAFT_CONFIRM_REPLY;
}

export async function enrichTaskUpdateDraft(
  ctx: AuthContext,
  draft: AiTaskUpdateDraftPayload,
): Promise<AiTaskUpdateDraftPayload> {
  const lookup = await lookupTaskForUpdate(ctx, {
    taskId: draft.taskId,
    taskSearchText: draft.taskSearchText,
  });

  if (lookup.status === 'resolved') {
    return {
      ...draft,
      taskId: lookup.task.id,
      currentTitle: lookup.task.title,
    };
  }

  return draft;
}
