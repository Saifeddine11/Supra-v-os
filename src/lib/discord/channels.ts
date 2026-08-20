import type { TaskDepartment } from '@/types/database';

export type ClientDiscordChannelSpec = {
  name: string;
  department: TaskDepartment | null;
};

export const CLIENT_DISCORD_CHANNEL_SPECS: readonly ClientDiscordChannelSpec[] = [
  { name: '💬・chat-général', department: null },
  { name: '🎥・production-vidéo', department: 'production_video' },
  { name: '📲・diffusion-vidéo', department: 'video_distribution' },
  { name: '📱・community-management', department: 'community_management' },
  { name: '📈・media-buying', department: 'media_buying' },
  { name: '💻・web-seo', department: 'web_seo' },
] as const;

export type InternalDiscordCategorySpec = {
  name: string;
  channels: readonly string[];
};

/** Agency-internal Discord categories. Never used to identify or link a client. */
export const INTERNAL_DISCORD_CATEGORY_SPECS: readonly InternalDiscordCategorySpec[] = [
  {
    name: '🏢 SUPRA',
    channels: ['📜・règlement', '📢・annonces', '📅・agenda', '🔗・ressources', '📝・compte-rendu'],
  },
  {
    name: '🔒 DIRECTION',
    channels: ['💬・direction', '📊・suivi-agence'],
  },
  {
    name: '👥 ÉQUIPE',
    channels: ['💬・général', '📅・planning-équipe'],
  },
  {
    name: '📋 PROJECT MANAGEMENT',
    channels: ['📌・projets', '✅・validations', '🚨・urgences'],
  },
] as const;

export const DISCORD_CHANNEL_TYPE_GUILD_TEXT = 0;
export const DISCORD_CHANNEL_TYPE_GUILD_CATEGORY = 4;
export const DISCORD_CHANNEL_TYPE_GUILD_FORUM = 15;
export const DISCORD_CHANNEL_TYPE_GUILD_MEDIA = 16;
export const DISCORD_OVERWRITE_TYPE_ROLE = 0;
export const DISCORD_OVERWRITE_TYPE_MEMBER = 1;

export function discordNamesMatch(a: string, b: string): boolean {
  return a.normalize('NFC') === b.normalize('NFC');
}

/** Unused leftover channels to flag only — never auto-deleted. */
export function isDiscordCleanupCandidate(channel: {
  name: string;
  type: number;
  parent_id?: string | null;
}): boolean {
  if (channel.type !== DISCORD_CHANNEL_TYPE_GUILD_TEXT) return false;
  const n = channel.name.normalize('NFC').toLowerCase();
  if (n === 'bot-test' || n === 'bot_test' || n === 'bottest') return true;
  const parentless = !channel.parent_id;
  return parentless && (n === 'général' || n === 'general');
}

/** VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES | READ_MESSAGE_HISTORY | ADD_REACTIONS */
export const DISCORD_STAFF_ALLOW_BITS =
  (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 15n) | (1n << 16n) | (1n << 6n);

/** MANAGE_CHANNELS */
export const DISCORD_MANAGE_CHANNELS_BIT = 1n << 4n;

/** MANAGE_ROLES — required by Discord to edit channel permission overwrites */
export const DISCORD_MANAGE_ROLES_BIT = 1n << 28n;

export const DISCORD_BOT_MANAGEMENT_ALLOW_BITS =
  DISCORD_MANAGE_CHANNELS_BIT | DISCORD_MANAGE_ROLES_BIT;

/**
 * VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | READ_MESSAGE_HISTORY |
 * MANAGE_CHANNELS | MANAGE_ROLES
 */
export const DISCORD_BOT_SELF_ALLOW_BITS =
  (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 16n) | DISCORD_BOT_MANAGEMENT_ALLOW_BITS;

/** VIEW_CHANNEL */
export const DISCORD_VIEW_CHANNEL_BIT = 1n << 10n;

export function parseDiscordBitfield(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === '') return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

export function mergeStaffAllowBits(existingAllow: bigint, existingDeny: bigint): {
  allow: bigint;
  deny: bigint;
} {
  return {
    allow: existingAllow | DISCORD_STAFF_ALLOW_BITS,
    deny: existingDeny & ~DISCORD_STAFF_ALLOW_BITS,
  };
}

export function mergeBotSelfAllowBits(existingAllow: bigint, existingDeny: bigint): {
  allow: bigint;
  deny: bigint;
} {
  return {
    allow: existingAllow | DISCORD_BOT_SELF_ALLOW_BITS,
    deny: existingDeny & ~DISCORD_BOT_SELF_ALLOW_BITS,
  };
}

export function botSelfOverwriteIncludesManagement(allow: bigint, deny: bigint): boolean {
  return (
    (allow & DISCORD_BOT_MANAGEMENT_ALLOW_BITS) === DISCORD_BOT_MANAGEMENT_ALLOW_BITS &&
    (deny & DISCORD_BOT_MANAGEMENT_ALLOW_BITS) === 0n
  );
}

export function mergeEveryoneDenyView(existingAllow: bigint, existingDeny: bigint): {
  allow: bigint;
  deny: bigint;
} {
  return {
    allow: existingAllow & ~DISCORD_VIEW_CHANNEL_BIT,
    deny: existingDeny | DISCORD_VIEW_CHANNEL_BIT,
  };
}
