import 'server-only';

import { normalizeDiscordSnowflake } from '@/lib/discord/config';
import type { TaskDepartment } from '@/types/database';

/** Stable Discord role snowflakes. Never resolved by role name at runtime. */
export type DiscordStaffRoleKey =
  | 'direction'
  | 'video_director'
  | 'cameraman'
  | 'editor'
  | 'community_manager'
  | 'media_buyer'
  | 'web_tech'
  | 'team';

const ROLE_ENV: Record<DiscordStaffRoleKey, string> = {
  direction: 'DISCORD_ROLE_DIRECTION',
  video_director: 'DISCORD_ROLE_VIDEO_DIRECTOR',
  cameraman: 'DISCORD_ROLE_CAMERAMAN',
  editor: 'DISCORD_ROLE_EDITOR',
  community_manager: 'DISCORD_ROLE_COMMUNITY_MANAGER',
  media_buyer: 'DISCORD_ROLE_MEDIA_BUYER',
  web_tech: 'DISCORD_ROLE_WEB_TECH',
  team: 'DISCORD_ROLE_TEAM',
};

export function getDiscordStaffRoleId(key: DiscordStaffRoleKey): string | null {
  return normalizeDiscordSnowflake(process.env[ROLE_ENV[key]] ?? '');
}

export function getConfiguredDiscordStaffRoles(): Record<DiscordStaffRoleKey, boolean> {
  return {
    direction: Boolean(getDiscordStaffRoleId('direction')),
    video_director: Boolean(getDiscordStaffRoleId('video_director')),
    cameraman: Boolean(getDiscordStaffRoleId('cameraman')),
    editor: Boolean(getDiscordStaffRoleId('editor')),
    community_manager: Boolean(getDiscordStaffRoleId('community_manager')),
    media_buyer: Boolean(getDiscordStaffRoleId('media_buyer')),
    web_tech: Boolean(getDiscordStaffRoleId('web_tech')),
    team: Boolean(getDiscordStaffRoleId('team')),
  };
}

const SPECIALIST_KEYS: DiscordStaffRoleKey[] = [
  'direction',
  'video_director',
  'cameraman',
  'editor',
  'community_manager',
  'media_buyer',
  'web_tech',
];

function idsFor(keys: DiscordStaffRoleKey[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const id = getDiscordStaffRoleId(key);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Role IDs that must be able to view a given client channel.
 * Direction is always included when configured.
 */
export function roleIdsForClientChannel(department: TaskDepartment | null): string[] {
  const direction = getDiscordStaffRoleId('direction');
  const keys: DiscordStaffRoleKey[] =
    department === null
      ? getDiscordStaffRoleId('team')
        ? ['team', 'direction']
        : SPECIALIST_KEYS
      : department === 'production_video'
        ? ['direction', 'video_director', 'cameraman', 'editor']
        : department === 'video_distribution'
          ? ['direction', 'video_director', 'editor', 'community_manager']
          : department === 'community_management'
            ? ['direction', 'community_manager']
            : department === 'media_buying'
              ? ['direction', 'media_buyer']
              : ['direction', 'web_tech'];

  const ids = idsFor(keys);
  if (direction && !ids.includes(direction)) ids.unshift(direction);
  return ids;
}
