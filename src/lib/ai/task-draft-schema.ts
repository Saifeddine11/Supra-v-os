import { z } from 'zod';
import {
  TASK_DRAFT_CONFIRM_REPLY,
  TASK_DRAFT_CONFIRM_REPLY_INCOMPLETE,
} from '@/lib/ai/supai-copy';

export { TASK_DRAFT_CONFIRM_REPLY, TASK_DRAFT_CONFIRM_REPLY_INCOMPLETE };

export const AI_TASK_DRAFT_PRIORITY = ['low', 'normal', 'high', 'urgent'] as const;
export const AI_TASK_DRAFT_STATUS = ['todo', 'in_progress'] as const;

/** Maps null / empty string from model JSON to undefined for optional fields. */
function nullishOptionalString(maxLen: number) {
  return z.preprocess(
    (v) => {
      if (v === null || v === undefined) return undefined;
      const s = String(v).trim();
      return s.length ? s : undefined;
    },
    z.string().max(maxLen).optional(),
  );
}

/** Structured task draft extracted from AI (names only — no guessed UUIDs). */
export const aiTaskDraftPayloadSchema = z.object({
  title: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string().min(1).max(160),
  ),
  description: nullishOptionalString(2000),
  assigneeName: nullishOptionalString(120),
  clientName: nullishOptionalString(160),
  deadlineText: nullishOptionalString(120),
  deadlineIso: nullishOptionalString(64),
  priority: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.enum(AI_TASK_DRAFT_PRIORITY).optional(),
  ),
  status: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.enum(AI_TASK_DRAFT_STATUS).optional(),
  ),
});

export type AiTaskDraftPayload = z.infer<typeof aiTaskDraftPayloadSchema>;

/** Confirmed task creation from UI (names resolved server-side). */
export const aiCreateTaskInputSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis.').max(160, 'Titre trop long (160 max).'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description trop longue (2000 max).')
    .optional(),
  clientId: z.string().uuid('clientId invalide.').optional(),
  clientName: z.string().trim().max(160).optional(),
  assigneeIds: z.array(z.string().uuid('assigneeId invalide.')).max(10).optional(),
  assigneeName: z.string().trim().max(120).optional(),
  deadline: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Échéance invalide.'),
  deadlineText: z.string().trim().max(120).optional(),
  priority: z.enum(AI_TASK_DRAFT_PRIORITY).optional(),
  status: z.enum(AI_TASK_DRAFT_STATUS).optional(),
});

export type AiCreateTaskInput = z.infer<typeof aiCreateTaskInputSchema>;

export const AI_TASK_PRIORITY_LABELS: Record<(typeof AI_TASK_DRAFT_PRIORITY)[number], string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgent',
};

export const AI_TASK_STATUS_LABELS: Record<(typeof AI_TASK_DRAFT_STATUS)[number], string> = {
  todo: 'À faire',
  in_progress: 'En cours',
};
