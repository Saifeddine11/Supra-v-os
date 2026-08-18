import 'server-only';

import { discordApiBase, getDiscordBotToken } from '@/lib/discord/config';

export type DiscordRestResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

type DiscordMessage = {
  id: string;
  channel_id: string;
};

function authHeader(token: string): string {
  return `Bot ${token}`;
}

function safeBodyPreview(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 180);
}

async function discordFetch<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<DiscordRestResult<T>> {
  const token = getDiscordBotToken();
  if (!token) {
    return { ok: false, status: 0, error: 'DISCORD_BOT_TOKEN is not set' };
  }

  try {
    const res = await fetch(`${discordApiBase()}${path}`, {
      method,
      headers: {
        Authorization: authHeader(token),
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });

    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `Discord API ${res.status}: ${safeBodyPreview(text) || res.statusText}`,
      };
    }
    if (!text) {
      return { ok: true, data: {} as T };
    }
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, status: res.status, error: 'Discord API returned invalid JSON' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network_error';
    return { ok: false, status: 0, error: msg };
  }
}

export async function discordCreateChannelMessage(
  channelId: string,
  payload: Record<string, unknown>,
): Promise<DiscordRestResult<DiscordMessage>> {
  return discordFetch<DiscordMessage>('POST', `/channels/${channelId}/messages`, payload);
}

export async function discordEditChannelMessage(
  channelId: string,
  messageId: string,
  payload: Record<string, unknown>,
): Promise<DiscordRestResult<DiscordMessage>> {
  return discordFetch<DiscordMessage>(
    'PATCH',
    `/channels/${channelId}/messages/${messageId}`,
    payload,
  );
}

export async function discordDeleteChannelMessage(
  channelId: string,
  messageId: string,
): Promise<DiscordRestResult<Record<string, never>>> {
  return discordFetch('DELETE', `/channels/${channelId}/messages/${messageId}`);
}
