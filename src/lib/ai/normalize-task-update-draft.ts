import type { AiTaskUpdateChanges, AiTaskUpdateDraftPayload } from '@/lib/ai/task-update-draft-schema';
import { AI_TASK_UPDATE_STATUS, type AiTaskUpdateStatus } from '@/lib/ai/task-update-draft-schema';
import { parseFrenchDateText } from '@/lib/ai/parse-task-deadline';
import { isPastOperationalDateTime } from '@/lib/dates/validate-future-date';
import { AI_TASK_DRAFT_PRIORITY } from '@/lib/ai/task-draft-schema';

const STATUS_PHRASES: Array<{ pattern: RegExp; status: AiTaskUpdateStatus }> = [
  { pattern: /\b(?:à|a)\s*faire\b|\btodo\b/i, status: 'todo' },
  { pattern: /\ben\s+cours\b|\bin[\s-]?progress\b/i, status: 'in_progress' },
  { pattern: /\battente\s+client\b|\bwaiting[\s_-]?client\b/i, status: 'waiting_client' },
  { pattern: /\ben\s+r[ée]vision\b|\breview\b/i, status: 'review' },
  { pattern: /\bbloqu[ée]\b|\bblocked\b/i, status: 'blocked' },
  { pattern: /\btermin[ée]\b|\bdone\b|\bfait\b/i, status: 'done' },
];

const PRIORITY_PHRASES: Array<{ pattern: RegExp; priority: (typeof AI_TASK_DRAFT_PRIORITY)[number] }> =
  [
    { pattern: /\burgent\b/i, priority: 'urgent' },
    { pattern: /\bhaute?\b|\bhigh\b/i, priority: 'high' },
    { pattern: /\bbasse?\b|\blow\b/i, priority: 'low' },
    { pattern: /\bnormal(?:e)?\b/i, priority: 'normal' },
  ];

export function parseFrenchTaskStatus(text: string): AiTaskUpdateStatus | undefined {
  const raw = text.trim();
  if (!raw) return undefined;
  for (const { pattern, status } of STATUS_PHRASES) {
    if (pattern.test(raw)) return status;
  }
  const direct = AI_TASK_UPDATE_STATUS.find((s) => s === raw.replace(/\s+/g, '_').toLowerCase());
  return direct;
}

export function parseFrenchTaskPriority(text: string) {
  const raw = text.trim();
  if (!raw) return undefined;
  for (const { pattern, priority } of PRIORITY_PHRASES) {
    if (pattern.test(raw)) return priority;
  }
  return undefined;
}

function normalizeChanges(changes: AiTaskUpdateChanges, userMessage: string): AiTaskUpdateChanges {
  const out: AiTaskUpdateChanges = { ...changes };

  if (out.deadlineText?.trim() && !out.deadlineIso) {
    const iso = parseFrenchDateText(out.deadlineText);
    if (iso) out.deadlineIso = iso;
  }

  if (out.deadlineIso && isPastOperationalDateTime(out.deadlineIso)) {
    out.deadlineIso = undefined;
  }

  if (
    /\b(retire|retirer|supprime|supprimer|enl[èe]ve|enlever|pas d['']?échéance|sans échéance|aucune échéance)\b/i.test(
      userMessage,
    )
  ) {
    out.clearDeadline = true;
    out.deadlineText = undefined;
    out.deadlineIso = undefined;
  }

  if (!out.status) {
    const statusFromMsg = parseFrenchTaskStatus(userMessage);
    if (statusFromMsg) out.status = statusFromMsg;
  }

  if (!out.priority) {
    const prioFromMsg = parseFrenchTaskPriority(userMessage);
    if (prioFromMsg) out.priority = prioFromMsg;
  }

  return out;
}

export function normalizeTaskUpdateDraft(
  draft: AiTaskUpdateDraftPayload,
  userMessage: string,
): AiTaskUpdateDraftPayload {
  return {
    ...draft,
    taskSearchText: draft.taskSearchText?.trim() || undefined,
    taskId: draft.taskId?.trim() || undefined,
    currentTitle: draft.currentTitle?.trim() || undefined,
    changes: normalizeChanges(draft.changes ?? {}, userMessage),
  };
}
