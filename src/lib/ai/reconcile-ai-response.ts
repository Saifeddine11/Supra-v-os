import 'server-only';

import type { AiStructuredResponse } from '@/lib/ai/intent-schema';
import {
  aiTaskDraftPayloadSchema,
  type AiTaskDraftPayload,
} from '@/lib/ai/task-draft-schema';
import {
  aiVideoDraftPayloadSchema,
  type AiVideoDraftPayload,
} from '@/lib/ai/video-draft-schema';
import {
  TASK_DRAFT_CONFIRM_REPLY,
  SUPAI_EMPTY_REPLY,
  VIDEO_DRAFT_CONFIRM_REPLY,
} from '@/lib/ai/supai-copy';
import { detectUserChatIntent } from '@/lib/ai/detect-user-intent';
import { extractTaskDraftFromUserMessage } from '@/lib/ai/extract-task-draft-from-message';
import { normalizeTaskDraft } from '@/lib/ai/normalize-task-draft';
import { extractVideoDraftFromUserMessage, normalizeVideoDraft } from '@/lib/ai/extract-video-draft-from-message';
import { looksLikeStructuredJson, stripModelArtifacts } from '@/lib/ai/parse-ai-response';

function impliesDirectTaskCreation(reply: string): boolean {
  return /\b(je vais créer|je crée|je vais ajouter|création en cours|tâche créée|task created)\b/i.test(
    reply,
  );
}

function impliesDirectVideoCreation(reply: string): boolean {
  return /\b(je vais créer|je crée|vidéo créée|video created|production créée)\b/i.test(reply);
}

function mergeTaskDraft(
  fromModel: AiTaskDraftPayload | null | undefined,
  fromUser: AiTaskDraftPayload | null,
  userMessage: string,
): AiTaskDraftPayload | null {
  const modelOk = fromModel ? aiTaskDraftPayloadSchema.safeParse(fromModel) : null;
  const userOk = fromUser ? aiTaskDraftPayloadSchema.safeParse(fromUser) : null;

  if (!modelOk?.success && !userOk?.success) return null;

  const merged: AiTaskDraftPayload = {
    title: (modelOk?.success ? modelOk.data.title : userOk!.data!.title) ?? 'Nouvelle tâche',
    description: modelOk?.success ? modelOk.data.description : userOk?.data?.description,
    assigneeName: userOk?.success ? userOk.data.assigneeName : modelOk?.data?.assigneeName,
    clientName: userOk?.success ? userOk.data.clientName : modelOk?.data?.clientName,
    deadlineText: userOk?.success ? userOk.data.deadlineText : modelOk?.data?.deadlineText,
    deadlineIso: modelOk?.success ? modelOk.data.deadlineIso : userOk?.data?.deadlineIso,
    priority: modelOk?.success ? modelOk.data.priority : userOk?.data?.priority,
    status: modelOk?.success ? modelOk.data.status : userOk?.data?.status,
  };

  return normalizeTaskDraft(merged, userMessage);
}

function mergeVideoDraft(
  fromModel: AiVideoDraftPayload | null | undefined,
  fromUser: AiVideoDraftPayload | null,
  userMessage: string,
): AiVideoDraftPayload | null {
  const modelOk = fromModel ? aiVideoDraftPayloadSchema.safeParse(fromModel) : null;
  const userOk = fromUser ? aiVideoDraftPayloadSchema.safeParse(fromUser) : null;

  if (!modelOk?.success && !userOk?.success) return null;

  const merged: AiVideoDraftPayload = {
    title: (modelOk?.success ? modelOk.data.title : userOk!.data!.title) ?? 'Nouvelle vidéo',
    clientName: userOk?.success ? userOk.data.clientName : modelOk?.data?.clientName,
    subject: userOk?.success ? userOk.data.subject : modelOk?.data?.subject,
    type: userOk?.success ? userOk.data.type : modelOk?.data?.type,
    shootingDateText: userOk?.success ? userOk.data.shootingDateText : modelOk?.data?.shootingDateText,
    shootingDateIso: modelOk?.success ? modelOk.data.shootingDateIso : userOk?.data?.shootingDateIso,
    clientDeliveryDateText:
      userOk?.success ? userOk.data.clientDeliveryDateText : modelOk?.data?.clientDeliveryDateText,
    clientDeliveryDateIso:
      modelOk?.success ? modelOk.data.clientDeliveryDateIso : userOk?.data?.clientDeliveryDateIso,
    editorName: userOk?.success ? userOk.data.editorName : modelOk?.data?.editorName,
    cameramanName: userOk?.success ? userOk.data.cameramanName : modelOk?.data?.cameramanName,
    priority: modelOk?.success ? modelOk.data.priority : userOk?.data?.priority,
    productionStatus: modelOk?.success ? modelOk.data.productionStatus : userOk?.data?.productionStatus,
    portalStatus: modelOk?.success ? modelOk.data.portalStatus : userOk?.data?.portalStatus,
    description: modelOk?.success ? modelOk.data.description : userOk?.data?.description,
  };

  return normalizeVideoDraft(merged, userMessage);
}

/**
 * Align model output with detected user intent — synthesize drafts, preserve message drafts.
 */
export function reconcileAiResponse(
  structured: AiStructuredResponse,
  rawModelText: string,
  userMessage: string,
  canCreateTasks: boolean,
  canCreateVideos: boolean,
): AiStructuredResponse {
  const userIntent = detectUserChatIntent(userMessage);
  const cleanedRaw = stripModelArtifacts(rawModelText);

  let reply = structured.reply?.trim() || cleanedRaw.trim();
  let intentType = structured.intentType;
  let taskDraft = structured.taskDraft;
  let videoDraft = structured.videoDraft;

  if (looksLikeStructuredJson(reply)) {
    reply = cleanedRaw.trim();
  }

  if (userIntent.isDraftMessage) {
    intentType = 'draft_message';
    if (!reply || looksLikeStructuredJson(reply) || reply.length < 10) {
      reply = cleanedRaw.trim() || structured.reply;
    }
    if (!reply) {
      reply = SUPAI_EMPTY_REPLY;
    }
    return { reply, intentType: 'draft_message', taskDraft: null, videoDraft: null };
  }

  const shouldHaveVideoDraft =
    canCreateVideos &&
    (userIntent.isCreateVideo ||
      intentType === 'create_video_draft' ||
      Boolean(videoDraft));

  if (shouldHaveVideoDraft) {
    const synthesized = extractVideoDraftFromUserMessage(userMessage);
    videoDraft = mergeVideoDraft(videoDraft, synthesized, userMessage);

    if (videoDraft) {
      intentType = 'create_video_draft';
      reply = VIDEO_DRAFT_CONFIRM_REPLY;
      return { reply, intentType, taskDraft: null, videoDraft };
    }
  }

  if (intentType === 'create_video_draft' && videoDraft) {
    reply = VIDEO_DRAFT_CONFIRM_REPLY;
    return { reply, intentType, taskDraft: null, videoDraft };
  }

  if (reply && impliesDirectVideoCreation(reply) && userIntent.isCreateVideo && canCreateVideos) {
    const synthesized = extractVideoDraftFromUserMessage(userMessage);
    if (synthesized) {
      return {
        reply: VIDEO_DRAFT_CONFIRM_REPLY,
        intentType: 'create_video_draft',
        taskDraft: null,
        videoDraft: normalizeVideoDraft(synthesized, userMessage),
      };
    }
  }

  const shouldHaveTaskDraft =
    canCreateTasks &&
    (userIntent.isCreateTask ||
      intentType === 'create_task_draft' ||
      Boolean(taskDraft));

  if (shouldHaveTaskDraft) {
    const synthesized = extractTaskDraftFromUserMessage(userMessage);
    taskDraft = mergeTaskDraft(taskDraft, synthesized, userMessage);

    if (taskDraft) {
      intentType = 'create_task_draft';
      reply = TASK_DRAFT_CONFIRM_REPLY;
      return { reply, intentType, taskDraft, videoDraft: null };
    }
  }

  if (intentType === 'create_task_draft' && taskDraft) {
    taskDraft = normalizeTaskDraft(taskDraft, userMessage);
    reply = TASK_DRAFT_CONFIRM_REPLY;
    return { reply, intentType, taskDraft, videoDraft: null };
  }

  if (reply && impliesDirectTaskCreation(reply) && userIntent.isCreateTask && canCreateTasks) {
    const synthesized = extractTaskDraftFromUserMessage(userMessage);
    if (synthesized) {
      return {
        reply: TASK_DRAFT_CONFIRM_REPLY,
        intentType: 'create_task_draft',
        taskDraft: normalizeTaskDraft(synthesized, userMessage),
        videoDraft: null,
      };
    }
  }

  if (!reply) {
    reply = SUPAI_EMPTY_REPLY;
  }

  return {
    reply,
    intentType: intentType ?? 'general_chat',
    taskDraft: null,
    videoDraft: null,
  };
}
