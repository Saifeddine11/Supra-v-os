import 'server-only';

import type { AiTaskDraftPayload } from '@/lib/ai/task-draft-schema';
import type { AiVideoDraftPayload } from '@/lib/ai/video-draft-schema';
import {
  TASK_DRAFT_CONFIRM_REPLY,
  TASK_DRAFT_CONFIRM_REPLY_INCOMPLETE,
  VIDEO_DRAFT_CONFIRM_REPLY,
  VIDEO_DRAFT_CONFIRM_REPLY_INCOMPLETE,
} from '@/lib/ai/supai-copy';
import type { AuthContext } from '@/lib/auth/permissions';
import {
  previewClientResolution,
  previewTaskDraftReferences,
} from '@/lib/tasks/resolve-task-references';
import { isPastOperationalDateTime, SUPAI_PAST_DATE_REFUSAL } from '@/lib/dates/validate-future-date';

export async function buildTaskDraftReply(
  ctx: AuthContext,
  draft: AiTaskDraftPayload,
): Promise<string> {
  if (draft.deadlineIso?.trim() && isPastOperationalDateTime(draft.deadlineIso)) {
    return SUPAI_PAST_DATE_REFUSAL;
  }

  let incomplete = Boolean(draft.deadlineText?.trim() && !draft.deadlineIso?.trim());

  const preview = await previewTaskDraftReferences(ctx, {
    clientName: draft.clientName,
    assigneeName: draft.assigneeName,
  });

  if (draft.clientName?.trim()) {
    if (preview.client.status === 'not_found' || preview.client.status === 'ambiguous') {
      incomplete = true;
    }
  }

  if (draft.assigneeName?.trim()) {
    if (preview.assignee.status === 'not_found' || preview.assignee.status === 'ambiguous') {
      incomplete = true;
    }
  }

  return incomplete ? TASK_DRAFT_CONFIRM_REPLY_INCOMPLETE : TASK_DRAFT_CONFIRM_REPLY;
}

export async function buildVideoDraftReply(
  ctx: AuthContext,
  draft: AiVideoDraftPayload,
): Promise<string> {
  if (
    (draft.shootingDateIso?.trim() && isPastOperationalDateTime(draft.shootingDateIso)) ||
    (draft.clientDeliveryDateIso?.trim() && isPastOperationalDateTime(draft.clientDeliveryDateIso))
  ) {
    return SUPAI_PAST_DATE_REFUSAL;
  }

  let incomplete = false;

  if (draft.clientName?.trim()) {
    const preview = await previewClientResolution(ctx, draft.clientName);
    if (preview.status === 'not_found' || preview.status === 'ambiguous') {
      incomplete = true;
    }
  }

  return incomplete ? VIDEO_DRAFT_CONFIRM_REPLY_INCOMPLETE : VIDEO_DRAFT_CONFIRM_REPLY;
}
