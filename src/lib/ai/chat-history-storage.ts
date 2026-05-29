import { z } from 'zod';
import { AI_CHAT_MAX_MESSAGE_CHARS, AI_CHAT_MAX_MESSAGES } from '@/lib/ai/chat-schema';
import { AI_INTENT_TYPES } from '@/lib/ai/intent-schema';
import { aiTaskDraftPayloadSchema } from '@/lib/ai/task-draft-schema';
import { aiVideoDraftPayloadSchema } from '@/lib/ai/video-draft-schema';

export const AI_CHAT_HISTORY_KEY_PREFIX = 'supra_ai_chat_history_v1';

const contextLinkSchema = z.object({
  label: z.string().max(200),
  href: z.string().max(500),
  kind: z.enum(['task', 'video', 'client']),
});

export const storedChatMessageSchema = z.object({
  id: z.string().min(1).max(80),
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(AI_CHAT_MAX_MESSAGE_CHARS),
  createdAt: z.string().min(1).max(40),
  intentType: z.enum(AI_INTENT_TYPES).optional(),
  taskDraft: aiTaskDraftPayloadSchema.nullish(),
  videoDraft: aiVideoDraftPayloadSchema.nullish(),
  contextLinks: z.array(contextLinkSchema).max(8).optional(),
  taskDraftStatus: z.enum(['pending', 'created', 'dismissed']).optional(),
  videoDraftStatus: z.enum(['pending', 'created', 'dismissed']).optional(),
  createdTaskId: z.string().uuid().optional(),
  createdVideoId: z.string().uuid().optional(),
});

export const chatHistoryBlobSchema = z.object({
  userId: z.string().min(1).max(120),
  updatedAt: z.string().min(1).max(40),
  messages: z.array(storedChatMessageSchema).max(AI_CHAT_MAX_MESSAGES),
});

export type StoredChatMessage = z.infer<typeof storedChatMessageSchema>;
export type ChatHistoryBlob = z.infer<typeof chatHistoryBlobSchema>;

export type ChatHistoryUserRef = {
  userId?: string | null;
  employeeId?: string | null;
  email?: string | null;
};

export function resolveChatHistoryUserKey(ref: ChatHistoryUserRef): string {
  const userId = ref.userId?.trim();
  if (userId) return userId;
  const employeeId = ref.employeeId?.trim();
  if (employeeId) return employeeId;
  const email = ref.email?.trim().toLowerCase();
  if (email) return email;
  return 'unknown';
}

export function buildChatHistoryStorageKey(userKey: string): string {
  return `${AI_CHAT_HISTORY_KEY_PREFIX}:${userKey}`;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadChatHistory(storageKey: string): StoredChatMessage[] | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const json = JSON.parse(raw) as unknown;
    const parsed = chatHistoryBlobSchema.safeParse(json);
    if (!parsed.success || parsed.data.messages.length === 0) return null;
    return parsed.data.messages;
  } catch {
    return null;
  }
}

export function saveChatHistory(
  storageKey: string,
  userKey: string,
  messages: StoredChatMessage[],
): void {
  if (!isBrowser()) return;
  const trimmed = messages
    .filter((m) => m.content.trim().length > 0)
    .slice(-AI_CHAT_MAX_MESSAGES);

  if (trimmed.length === 0) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  const blob: ChatHistoryBlob = {
    userId: userKey,
    updatedAt: new Date().toISOString(),
    messages: trimmed,
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(blob));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function clearChatHistory(storageKey: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

export function newChatMessageId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
