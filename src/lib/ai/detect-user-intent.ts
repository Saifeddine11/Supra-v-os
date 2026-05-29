import 'server-only';

import type { AiIntentType } from '@/lib/ai/intent-schema';
import {
  isStructuredMessageTemplate,
  isStructuredTaskTemplate,
  isStructuredVideoTemplate,
} from '@/lib/ai/parse-structured-template';

export type DetectedUserChatIntent = {
  type: AiIntentType | 'none';
  isCreateTask: boolean;
  isCreateVideo: boolean;
  isDraftMessage: boolean;
};

const CREATE_TASK_PATTERNS = [
  /\bcrée(?:r)?\s+(?:une\s+)?tâche\b/i,
  /\bcrée(?:r)?\s+(?:une\s+)?tache\b/i,
  /\bajoute(?:r)?\s+(?:une\s+)?tâche\b/i,
  /\bajoute(?:r)?\s+(?:une\s+)?tache\b/i,
  /\bmets(?:tre)?\s+(?:une\s+)?tâche\b/i,
  /\bmets(?:tre)?\s+(?:une\s+)?tache\b/i,
  /\bajout(?:er)?\s+(?:une\s+)?tâche\b/i,
  /\bje souhaite créer une tâche\b/i,
  /\bje souhaite créer une tache\b/i,
  /\bje veux créer une tâche\b/i,
  /\bnouvelle tâche\b/i,
];

const CREATE_VIDEO_PATTERNS = [
  /\bcrée(?:r)?\s+(?:une\s+)?vidéo\b/i,
  /\bcrée(?:r)?\s+(?:une\s+)?video\b/i,
  /\bajoute(?:r)?\s+(?:une\s+)?vidéo\b/i,
  /\bajoute(?:r)?\s+(?:une\s+)?video\b/i,
  /\bproduction\s+vidéo\b/i,
  /\bproduction\s+video\b/i,
  /\bplanifier\s+(?:une\s+)?(?:vidéo|production)\b/i,
  /\bpréparer\s+(?:un\s+)?tournage\b/i,
  /\bpreparer\s+(?:un\s+)?tournage\b/i,
  /\bcréer\s+(?:un\s+)?contenu\s+vidéo\b/i,
  /\bcreer\s+(?:un\s+)?contenu\s+video\b/i,
  /\bnouvelle\s+(?:vidéo|production\s+vidéo)\b/i,
  /\bje souhaite créer une vidéo\b/i,
  /\bje souhaite créer une video\b/i,
];

const DRAFT_MESSAGE_PATTERNS = [
  /\bécris(?:\s+un|\s+une)?\s+(?:message|whatsapp|mail|e-mail|sms|relance)\b/i,
  /\becris(?:\s+un|\s+une)?\s+(?:message|whatsapp|mail|e-mail|sms|relance)\b/i,
  /\brédige(?:\s+un|\s+une)?\s+(?:message|whatsapp|mail|e-mail|relance)\b/i,
  /\bredige(?:\s+un|\s+une)?\s+(?:message|whatsapp|mail|e-mail|relance)\b/i,
  /\bprépare(?:\s+un|\s+une)?\s+(?:message|relance|whatsapp)\b/i,
  /\bprepare(?:\s+un|\s+une)?\s+(?:message|relance|whatsapp)\b/i,
  /\bmessage whatsapp\b/i,
  /\brelance(?:\s+courtoise|\s+client)?\b/i,
  /\bje souhaite rédiger un message\b/i,
  /\bje souhaite rediger un message\b/i,
];

export function detectUserChatIntent(message: string): DetectedUserChatIntent {
  const text = message.trim();
  if (!text) {
    return { type: 'none', isCreateTask: false, isCreateVideo: false, isDraftMessage: false };
  }

  if (isStructuredVideoTemplate(text)) {
    return {
      type: 'create_video_draft',
      isCreateTask: false,
      isCreateVideo: true,
      isDraftMessage: false,
    };
  }
  if (isStructuredTaskTemplate(text)) {
    return {
      type: 'create_task_draft',
      isCreateTask: true,
      isCreateVideo: false,
      isDraftMessage: false,
    };
  }
  if (isStructuredMessageTemplate(text)) {
    return {
      type: 'draft_message',
      isCreateTask: false,
      isCreateVideo: false,
      isDraftMessage: true,
    };
  }

  const isCreateVideo = CREATE_VIDEO_PATTERNS.some((p) => p.test(text));
  const isCreateTask =
    !isCreateVideo && CREATE_TASK_PATTERNS.some((p) => p.test(text));
  const isDraftMessage =
    !isCreateTask && !isCreateVideo && DRAFT_MESSAGE_PATTERNS.some((p) => p.test(text));

  let type: AiIntentType | 'none' = 'none';
  if (isCreateVideo) type = 'create_video_draft';
  else if (isCreateTask) type = 'create_task_draft';
  else if (isDraftMessage) type = 'draft_message';

  return { type, isCreateTask, isCreateVideo, isDraftMessage };
}
