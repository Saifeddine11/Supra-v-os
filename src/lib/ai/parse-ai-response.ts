import {
  AI_INTENT_TYPES,
  aiStructuredResponseSchema,
  type AiIntentType,
  type AiStructuredResponse,
} from '@/lib/ai/intent-schema';
import {
  aiTaskDraftPayloadSchema,
  TASK_DRAFT_CONFIRM_REPLY,
  type AiTaskDraftPayload,
} from '@/lib/ai/task-draft-schema';
import {
  aiTaskUpdateDraftPayloadSchema,
  TASK_UPDATE_DRAFT_CONFIRM_REPLY,
  type AiTaskUpdateDraftPayload,
} from '@/lib/ai/task-update-draft-schema';
import {
  aiVideoDraftPayloadSchema,
  VIDEO_DRAFT_CONFIRM_REPLY,
  type AiVideoDraftPayload,
} from '@/lib/ai/video-draft-schema';
import {
  SUPAI_EMPTY_REPLY,
  SUPAI_PARSE_FALLBACK_REPLY,
} from '@/lib/ai/supai-copy';

export function looksLikeStructuredJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') && (t.includes('"intentType"') || t.includes('"reply"'));
}

export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/** Plain readable text after stripping code fences / broken JSON wrappers. */
export function stripModelArtifacts(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(trimmed);
  if (fence?.[1]) {
    const inner = fence[1].trim();
    const extracted = extractReplyFromBrokenJson(inner);
    if (extracted) return extracted;
    if (!looksLikeStructuredJson(inner)) return inner;
  }

  const extracted = extractReplyFromBrokenJson(trimmed);
  if (extracted) return extracted;

  if (looksLikeStructuredJson(trimmed)) {
    return '';
  }

  return trimmed;
}

function extractReplyFromBrokenJson(raw: string): string | null {
  const match = /"reply"\s*:\s*"((?:\\.|[^"\\])*)"/s.exec(raw);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
  }
}

function parseJsonObject(raw: string): unknown | null {
  const cleaned = stripCodeFence(raw);
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    return null;
  }
}

function looseStructuredParse(json: unknown): AiStructuredResponse | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;

  const replyRaw = o.reply;
  const reply = typeof replyRaw === 'string' ? replyRaw.trim() : '';
  if (!reply) return null;

  const intentRaw = o.intentType;
  const intentType = AI_INTENT_TYPES.includes(intentRaw as AiIntentType)
    ? (intentRaw as AiIntentType)
    : 'general_chat';

  let taskDraft: AiTaskDraftPayload | null = null;
  if (o.taskDraft != null && typeof o.taskDraft === 'object') {
    const draftParsed = aiTaskDraftPayloadSchema.safeParse(o.taskDraft);
    taskDraft = draftParsed.success ? draftParsed.data : null;
  }

  let videoDraft: AiVideoDraftPayload | null = null;
  if (o.videoDraft != null && typeof o.videoDraft === 'object') {
    const draftParsed = aiVideoDraftPayloadSchema.safeParse(o.videoDraft);
    videoDraft = draftParsed.success ? draftParsed.data : null;
  }

  let taskUpdateDraft: AiTaskUpdateDraftPayload | null = null;
  if (o.taskUpdateDraft != null && typeof o.taskUpdateDraft === 'object') {
    const draftParsed = aiTaskUpdateDraftPayloadSchema.safeParse(o.taskUpdateDraft);
    taskUpdateDraft = draftParsed.success ? draftParsed.data : null;
  }

  return { reply, intentType, taskDraft, videoDraft, taskUpdateDraft };
}

function normalizeCreateTaskDraftResponse(structured: AiStructuredResponse): AiStructuredResponse {
  if (structured.intentType !== 'create_task_draft' && !structured.taskDraft) {
    return structured;
  }

  const draftParsed = structured.taskDraft
    ? aiTaskDraftPayloadSchema.safeParse(structured.taskDraft)
    : null;
  const taskDraft = draftParsed?.success ? draftParsed.data : structured.taskDraft ?? null;

  if (!taskDraft) {
    return structured;
  }

  const reply =
    structured.reply && !looksLikeStructuredJson(structured.reply)
      ? structured.reply
      : TASK_DRAFT_CONFIRM_REPLY;

  return {
    reply,
    intentType: 'create_task_draft',
    taskDraft,
    videoDraft: null,
    taskUpdateDraft: null,
  };
}

function normalizeUpdateTaskDraftResponse(structured: AiStructuredResponse): AiStructuredResponse {
  if (structured.intentType !== 'update_task_draft' && !structured.taskUpdateDraft) {
    return structured;
  }

  const draftParsed = structured.taskUpdateDraft
    ? aiTaskUpdateDraftPayloadSchema.safeParse(structured.taskUpdateDraft)
    : null;
  const taskUpdateDraft = draftParsed?.success
    ? draftParsed.data
    : structured.taskUpdateDraft ?? null;

  if (!taskUpdateDraft) {
    return structured;
  }

  const reply =
    structured.reply && !looksLikeStructuredJson(structured.reply)
      ? structured.reply
      : TASK_UPDATE_DRAFT_CONFIRM_REPLY;

  return {
    reply,
    intentType: 'update_task_draft',
    taskDraft: null,
    videoDraft: null,
    taskUpdateDraft,
  };
}

function normalizeCreateVideoDraftResponse(structured: AiStructuredResponse): AiStructuredResponse {
  if (structured.intentType !== 'create_video_draft' && !structured.videoDraft) {
    return structured;
  }

  const draftParsed = structured.videoDraft
    ? aiVideoDraftPayloadSchema.safeParse(structured.videoDraft)
    : null;
  const videoDraft = draftParsed?.success ? draftParsed.data : structured.videoDraft ?? null;

  if (!videoDraft) {
    return structured;
  }

  const reply =
    structured.reply && !looksLikeStructuredJson(structured.reply)
      ? structured.reply
      : VIDEO_DRAFT_CONFIRM_REPLY;

  return {
    reply,
    intentType: 'create_video_draft',
    taskDraft: null,
    videoDraft,
    taskUpdateDraft: null,
  };
}

function plainTextFallback(raw: string): AiStructuredResponse {
  const artifacts = stripModelArtifacts(raw);
  const text = artifacts.trim();

  if (!text) {
    return {
      reply: SUPAI_EMPTY_REPLY,
      intentType: 'general_chat',
      taskDraft: null,
      videoDraft: null,
      taskUpdateDraft: null,
    };
  }

  return {
    reply: text,
    intentType: 'general_chat',
    taskDraft: null,
    videoDraft: null,
    taskUpdateDraft: null,
  };
}

export function parseAiStructuredResponse(raw: string): AiStructuredResponse {
  const json = parseJsonObject(raw);
  if (json) {
    const parsed = aiStructuredResponseSchema.safeParse(json);
    if (parsed.success) {
      const withUpdate = normalizeUpdateTaskDraftResponse(parsed.data);
      const withVideo = normalizeCreateVideoDraftResponse(withUpdate);
      return normalizeCreateTaskDraftResponse(withVideo);
    }
    const loose = looseStructuredParse(json);
    if (loose) {
      const withUpdate = normalizeUpdateTaskDraftResponse(loose);
      const withVideo = normalizeCreateVideoDraftResponse(withUpdate);
      return normalizeCreateTaskDraftResponse(withVideo);
    }
  }

  const extractedReply = extractReplyFromBrokenJson(raw);
  if (extractedReply) {
    return {
      reply: extractedReply,
      intentType: 'general_chat',
      taskDraft: null,
      videoDraft: null,
      taskUpdateDraft: null,
    };
  }

  return plainTextFallback(raw);
}
