import 'server-only';

/** Discord snowflake (channel, message, or user id). */
export const DISCORD_SNOWFLAKE_RE = /^[0-9]{17,20}$/;

export function isDiscordSnowflake(value: string | null | undefined): value is string {
  return Boolean(value && DISCORD_SNOWFLAKE_RE.test(value.trim()));
}

export function normalizeDiscordSnowflake(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return isDiscordSnowflake(t) ? t : null;
}

export function getDiscordBotToken(): string | null {
  const raw = process.env.DISCORD_BOT_TOKEN?.trim();
  return raw || null;
}

export function getDiscordGuildId(): string | null {
  return normalizeDiscordSnowflake(process.env.DISCORD_GUILD_ID ?? '');
}

/** Live SUPRA → Discord task posts. Client provisioning and the test route work without this flag. */
export function isDiscordTaskSyncEnabled(): boolean {
  if (!getDiscordBotToken()) return false;
  const v = (process.env.DISCORD_TASK_SYNC_ENABLED ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function discordApiBase(): string {
  return 'https://discord.com/api/v10';
}
