import { z } from 'zod';
import {
  TASK_UPDATE_DRAFT_CONFIRM_REPLY,
  TASK_UPDATE_DRAFT_EMPTY_CHANGES,
  TASK_UPDATE_DRAFT_NOT_FOUND,
} from '@/lib/ai/supai-copy';
import { AI_TASK_DRAFT_PRIORITY } from '@/lib/ai/task-draft-schema';

export {
  TASK_UPDATE_DRAFT_CONFIRM_REPLY,
  TASK_UPDATE_DRAFT_EMPTY_CHANGES,
  TASK_UPDATE_DRAFT_NOT_FOUND,
};

/** Statuses allowed via SupAI update (workflow kanban — not archived). */
export const AI_TASK_UPDATE_STATUS = [
  'todo',
  'in_progress',
  'waiting_client',
  'waiting_team',
  'review',
  'blocked',
  'done',
] as const;

export type AiTaskUpdateStatus = (typeof AI_TASK_UPDATE_STATUS)[number];

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

export const aiTaskUpdateChangesSchema = z.object({
  title: nullishOptionalString(160),
  description: nullishOptionalString(2000),
  deadlineText: nullishOptionalString(120),
  deadlineIso: nullishOptionalString(64),
  clearDeadline: z.boolean().optional(),
  priority: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.enum(AI_TASK_DRAFT_PRIORITY).optional(),
  ),
  status: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.enum(AI_TASK_UPDATE_STATUS).optional(),
  ),
  clientName: nullishOptionalString(160),
  assigneeName: nullishOptionalString(120),
  assigneeNames: z.array(z.string().trim().max(120)).max(10).optional(),
});

export type AiTaskUpdateChanges = z.infer<typeof aiTaskUpdateChangesSchema>;

export const aiTaskUpdateDraftPayloadSchema = z.object({
  taskSearchText: nullishOptionalString(160),
  taskId: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.string().uuid().optional(),
  ),
  currentTitle: nullishOptionalString(160),
  changes: aiTaskUpdateChangesSchema.default({}),
});

export type AiTaskUpdateDraftPayload = z.infer<typeof aiTaskUpdateDraftPayloadSchema>;

export const aiUpdateTaskInputSchema = z
  .object({
    taskId: z.string().uuid('taskId invalide.'),
    changes: z
      .object({
        title: z.string().trim().min(1).max(160).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        deadline: z
          .string()
          .trim()
          .nullable()
          .optional()
          .refine((v) => v === undefined || v === null || !Number.isNaN(Date.parse(v)), {
            message: 'Échéance invalide.',
          }),
        priority: z.enum(AI_TASK_DRAFT_PRIORITY).optional(),
        status: z.enum(AI_TASK_UPDATE_STATUS).optional(),
        clientId: z.string().uuid().optional(),
        clientName: z.string().trim().max(160).optional(),
        assigneeIds: z.array(z.string().uuid()).max(10).optional(),
        assigneeName: z.string().trim().max(120).optional(),
      })
      .refine(
        (c) =>
          c.title !== undefined ||
          c.description !== undefined ||
          c.deadline !== undefined ||
          c.priority !== undefined ||
          c.status !== undefined ||
          c.clientId !== undefined ||
          c.clientName !== undefined ||
          c.assigneeIds !== undefined ||
          c.assigneeName !== undefined,
        { message: 'Au moins une modification est requise.' },
      ),
  })
  .strict();

export type AiUpdateTaskInput = z.infer<typeof aiUpdateTaskInputSchema>;

export function hasTaskUpdateChanges(changes: AiTaskUpdateChanges | undefined): boolean {
  if (!changes) return false;
  return Boolean(
    changes.title ||
      changes.description ||
      changes.deadlineText ||
      changes.deadlineIso ||
      changes.clearDeadline ||
      changes.priority ||
      changes.status ||
      changes.clientName ||
      changes.assigneeName ||
      (changes.assigneeNames && changes.assigneeNames.length > 0),
  );
}

export const AI_TASK_UPDATE_STATUS_LABELS: Record<AiTaskUpdateStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  waiting_client: 'Attente client',
  waiting_team: 'En attente équipe',
  review: 'En révision',
  blocked: 'Bloqué',
  done: 'Terminé',
};
