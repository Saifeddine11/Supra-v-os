import 'server-only';

import { discordApiBase, getDiscordBotToken } from '@/lib/discord/config';
import { DISCORD_OVERWRITE_TYPE_ROLE } from '@/lib/discord/channels';

export type DiscordRestResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

type DiscordMessage = {
  id: string;
  channel_id: string;
};

export type DiscordPermissionOverwrite = {
  id: string;
  type: number;
  allow: string;
  deny: string;
};

export type DiscordChannel = {
  id: string;
  type: number;
  name: string;
  parent_id: string | null;
  permission_overwrites?: DiscordPermissionOverwrite[];
};

function authHeader(token: string): string {
  return `Bot ${token}`;
}

function safeBodyPreview(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 180);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await fetch(`${discordApiBase()}${path}`, {
        method,
        headers: {
          Authorization: authHeader(token),
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      });

      if (res.status === 429 && attempt < 4) {
        const retryRaw = res.headers.get('Retry-After');
        const retrySec = Number(retryRaw);
        const waitMs = Number.isFinite(retrySec)
          ? Math.min(Math.max(retrySec * 1000, 400), 12_000)
          : 1000 * (attempt + 1);
        await sleep(waitMs);
        continue;
      }

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
    }
    return { ok: false, status: 429, error: 'Discord API rate limited' };
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

export async function discordGetChannel(
  channelId: string,
): Promise<DiscordRestResult<DiscordChannel>> {
  return discordFetch<DiscordChannel>('GET', `/channels/${channelId}`);
}

export async function discordListGuildChannels(
  guildId: string,
): Promise<DiscordRestResult<DiscordChannel[]>> {
  return discordFetch<DiscordChannel[]>('GET', `/guilds/${guildId}/channels`);
}

export async function discordCreateGuildChannel(
  guildId: string,
  payload: {
    name: string;
    type: number;
    parent_id?: string;
  },
): Promise<DiscordRestResult<DiscordChannel>> {
  return discordFetch<DiscordChannel>('POST', `/guilds/${guildId}/channels`, payload);
}

export async function discordPutChannelRoleOverwrite(
  channelId: string,
  roleId: string,
  allow: bigint,
  deny: bigint,
): Promise<DiscordRestResult<Record<string, never>>> {
  return discordFetch('PUT', `/channels/${channelId}/permissions/${roleId}`, {
    type: DISCORD_OVERWRITE_TYPE_ROLE,
    allow: allow.toString(),
    deny: deny.toString(),
  });
}
