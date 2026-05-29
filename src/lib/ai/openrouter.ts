import 'server-only';

import {
  SUPAI_ERROR_NOT_CONFIGURED,
  SUPAI_ERROR_UNAVAILABLE,
} from '@/lib/ai/supai-copy';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 60_000;

export type OpenRouterChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export class OpenRouterChatError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'OpenRouterChatError';
    this.status = status;
  }
}

function resolveModel(): string {
  const model = process.env.AI_MODEL?.trim();
  return model || 'openrouter/free';
}

function resolveApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new OpenRouterChatError(SUPAI_ERROR_NOT_CONFIGURED, 503);
  }
  return key;
}

export async function completeOpenRouterChat(
  messages: OpenRouterChatMessage[],
  options?: { temperature?: number },
): Promise<string> {
  const provider = (process.env.AI_PROVIDER?.trim() || 'openrouter').toLowerCase();
  if (provider !== 'openrouter') {
    throw new OpenRouterChatError('Fournisseur IA non pris en charge.', 503);
  }

  const apiKey = resolveApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app.suprav3.com',
        'X-Title': 'Supra v. Agency OS',
      },
      body: JSON.stringify({
        model: resolveModel(),
        messages,
        temperature: options?.temperature ?? 0.4,
      }),
      signal: controller.signal,
    });

    const raw = await res.text();
    let payload: unknown = null;
    if (raw) {
      try {
        payload = JSON.parse(raw) as unknown;
      } catch {
        payload = null;
      }
    }

    if (!res.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[openrouter] HTTP', res.status, raw.slice(0, 500));
      }
      throw new OpenRouterChatError(SUPAI_ERROR_UNAVAILABLE, 502);
    }

    const content =
      payload &&
      typeof payload === 'object' &&
      'choices' in payload &&
      Array.isArray((payload as { choices: unknown }).choices)
        ? (payload as { choices: { message?: { content?: string } }[] }).choices[0]?.message?.content
        : null;

    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) {
      throw new OpenRouterChatError(SUPAI_ERROR_UNAVAILABLE, 502);
    }

    return text;
  } catch (e) {
    if (e instanceof OpenRouterChatError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new OpenRouterChatError(SUPAI_ERROR_UNAVAILABLE, 504);
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('[openrouter] fetch failed', e);
    }
    throw new OpenRouterChatError(SUPAI_ERROR_UNAVAILABLE, 502);
  } finally {
    clearTimeout(timeout);
  }
}
