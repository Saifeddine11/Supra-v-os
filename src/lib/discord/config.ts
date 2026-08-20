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

function envFlagEnabled(name: string): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Live SUPRA → Discord task posts. Client provisioning and the test route work without this flag. */
export function isDiscordTaskSyncEnabled(): boolean {
  if (!getDiscordBotToken()) return false;
  return envFlagEnabled('DISCORD_TASK_SYNC_ENABLED');
}

/**
 * Phase 1.1 operational Discord reminders (deadlines, waiting_team, shooting).
 * Independent of task-card sync. Default off until verified.
 */
export function isDiscordOperationalRemindersEnabled(): boolean {
  if (!getDiscordBotToken()) return false;
  return envFlagEnabled('DISCORD_OPERATIONAL_REMINDERS_ENABLED');
}

/** Discord user snowflake for CEO / waiting_team validation mentions. Not an employee lookup. */
export function getDiscordValidationApproverUserId(): string | null {
  return normalizeDiscordSnowflake(process.env.DISCORD_VALIDATION_APPROVER_USER_ID ?? '');
}

export function discordApiBase(): string {
  return 'https://discord.com/api/v10';
}
