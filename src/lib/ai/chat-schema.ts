import { z } from 'zod';

export const AI_CHAT_MAX_MESSAGES = 20;
export const AI_CHAT_MAX_MESSAGE_CHARS = 4000;

export const aiChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z
          .string()
          .trim()
          .min(1, 'Message vide.')
          .max(AI_CHAT_MAX_MESSAGE_CHARS, `Maximum ${AI_CHAT_MAX_MESSAGE_CHARS} caractères par message.`),
      }),
    )
    .min(1, 'Au moins un message requis.')
    .max(AI_CHAT_MAX_MESSAGES, `Maximum ${AI_CHAT_MAX_MESSAGES} messages par conversation.`),
});

export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

export type AiChatMessage = AiChatRequest['messages'][number];
