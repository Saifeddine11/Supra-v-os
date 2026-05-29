import { z } from 'zod';
import {
  aiTaskDraftPayloadSchema,
  type AiTaskDraftPayload,
} from '@/lib/ai/task-draft-schema';
import {
  aiTaskUpdateDraftPayloadSchema,
  type AiTaskUpdateDraftPayload,
} from '@/lib/ai/task-update-draft-schema';
import {
  aiVideoDraftPayloadSchema,
  type AiVideoDraftPayload,
} from '@/lib/ai/video-draft-schema';

export const AI_INTENT_TYPES = [
  'general_chat',
  'draft_message',
  'create_task_draft',
  'create_video_draft',
  'update_task_draft',
  'summarize_work',
  'ask_calendar_scope',
  'operational_results',
] as const;

export type AiIntentType = (typeof AI_INTENT_TYPES)[number];

export const aiStructuredResponseSchema = z.object({
  reply: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string().min(1),
  ),
  intentType: z.enum(AI_INTENT_TYPES),
  taskDraft: z.preprocess(
    (v) => (v === null ? undefined : v),
    aiTaskDraftPayloadSchema.nullish(),
  ),
  videoDraft: z.preprocess(
    (v) => (v === null ? undefined : v),
    aiVideoDraftPayloadSchema.nullish(),
  ),
  taskUpdateDraft: z.preprocess(
    (v) => (v === null ? undefined : v),
    aiTaskUpdateDraftPayloadSchema.nullish(),
  ),
});

export type AiStructuredResponse = z.infer<typeof aiStructuredResponseSchema>;

/** Client-safe payload returned by /api/ai/chat */
export type AiChatApiPayload = {
  message: { role: 'assistant'; content: string };
  intentType: AiIntentType;
  taskDraft?: AiTaskDraftPayload | null;
  videoDraft?: AiVideoDraftPayload | null;
  taskUpdateDraft?: AiTaskUpdateDraftPayload | null;
  contextLinks?: import('@/lib/ai/context-schema').AiContextLink[];
  contextMeta?: { tool: string; empty: boolean; truncated: boolean };
  resultGroups?: import('@/lib/ai/result-groups-schema').SupaiResultGroup[];
};

export type { AiTaskDraftPayload, AiVideoDraftPayload, AiTaskUpdateDraftPayload };
