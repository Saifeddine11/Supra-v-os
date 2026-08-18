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

export const DISCORD_CHANNEL_TYPE_GUILD_TEXT = 0;
export const DISCORD_CHANNEL_TYPE_GUILD_CATEGORY = 4;
export const DISCORD_OVERWRITE_TYPE_ROLE = 0;
export const DISCORD_OVERWRITE_TYPE_MEMBER = 1;

/** VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES | READ_MESSAGE_HISTORY | ADD_REACTIONS */
export const DISCORD_STAFF_ALLOW_BITS =
  (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 15n) | (1n << 16n) | (1n << 6n);

/** VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | READ_MESSAGE_HISTORY */
export const DISCORD_BOT_SELF_ALLOW_BITS =
  (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 16n);

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

export function mergeEveryoneDenyView(existingAllow: bigint, existingDeny: bigint): {
  allow: bigint;
  deny: bigint;
} {
  return {
    allow: existingAllow & ~DISCORD_VIEW_CHANNEL_BIT,
    deny: existingDeny | DISCORD_VIEW_CHANNEL_BIT,
  };
}
