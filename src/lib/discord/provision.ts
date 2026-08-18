import 'server-only';

import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getDiscordBotToken,
  getDiscordGuildId,
  normalizeDiscordSnowflake,
} from '@/lib/discord/config';
import {
  CLIENT_DISCORD_CHANNEL_SPECS,
  DISCORD_CHANNEL_TYPE_GUILD_CATEGORY,
  DISCORD_CHANNEL_TYPE_GUILD_TEXT,
  DISCORD_OVERWRITE_TYPE_MEMBER,
  DISCORD_OVERWRITE_TYPE_ROLE,
  mergeBotSelfAllowBits,
  mergeEveryoneDenyView,
  mergeStaffAllowBits,
  parseDiscordBitfield,
  type ClientDiscordChannelSpec,
} from '@/lib/discord/channels';
import { roleIdsForClientChannel } from '@/lib/discord/roles';
import {
  discordCreateGuildChannel,
  discordGetChannel,
  discordGetCurrentUser,
  discordListGuildChannels,
  discordPutChannelOverwrite,
  type DiscordChannel,
  type DiscordPermissionOverwrite,
} from '@/lib/discord/rest';
import { upsertDiscordChannelRoute } from '@/lib/discord/task-discord';
import type { TaskDepartment } from '@/types/database';

function logDiscord(message: string): void {
  console.error(`[discord] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function canProvisionDiscordClients(): boolean {
  return Boolean(getDiscordBotToken() && getDiscordGuildId());
}

function namesMatch(a: string, b: string): boolean {
  return a.normalize('NFC') === b.normalize('NFC');
}

function findChildByName(children: DiscordChannel[], name: string): DiscordChannel | undefined {
  return children.find(
    (ch) => ch.type === DISCORD_CHANNEL_TYPE_GUILD_TEXT && namesMatch(ch.name, name),
  );
}

async function loadClientDiscordState(clientId: string): Promise<{
  name: string;
  categoryId: string | null;
} | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('clients')
    .select('id, name, discord_category_id')
    .eq('id', clientId)
    .maybeSingle();
  if (error) {
    if (/discord_category_id/i.test(error.message)) {
      logDiscord('clients.discord_category_id missing; skip provision until migration is applied');
      return null;
    }
    logDiscord(`client load: ${error.message}`);
    return null;
  }
  if (!data) return null;
  return {
    name: String(data.name ?? 'Client'),
    categoryId: normalizeDiscordSnowflake(data.discord_category_id) ?? null,
  };
}

async function saveClientCategoryId(clientId: string, categoryId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('clients')
    .update({ discord_category_id: categoryId, updated_at: new Date().toISOString() })
    .eq('id', clientId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function categoryOwnedByOtherClient(
  categoryId: string,
  clientId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('clients')
    .select('id, name')
    .eq('discord_category_id', categoryId)
    .neq('id', clientId)
    .maybeSingle();
  if (error) {
    logDiscord(`category owner: ${error.message}`);
    return null;
  }
  if (!data) return null;
  return `${data.name} (${data.id})`;
}

async function verifyCategory(categoryId: string): Promise<{ ok: true; channel: DiscordChannel } | { ok: false; error: string }> {
  const res = await discordGetChannel(categoryId);
  if (!res.ok) return { ok: false, error: res.error };
  if (res.data.type !== DISCORD_CHANNEL_TYPE_GUILD_CATEGORY) {
    return { ok: false, error: 'discord_category_id is not a guild category.' };
  }
  return { ok: true, channel: res.data };
}

async function listCategoryTextChannels(categoryId: string): Promise<DiscordChannel[]> {
  const guildId = getDiscordGuildId();
  if (!guildId) return [];
  const listed = await discordListGuildChannels(guildId);
  if (!listed.ok) {
    logDiscord(`list guild channels: ${listed.error}`);
    return [];
  }
  return (listed.data ?? []).filter(
    (ch) =>
      ch.type === DISCORD_CHANNEL_TYPE_GUILD_TEXT &&
      (ch.parent_id ?? null) === categoryId,
  );
}

async function createTextChannel(
  categoryId: string,
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const guildId = getDiscordGuildId();
  if (!guildId) return { ok: false, error: 'DISCORD_GUILD_ID is not set.' };
  const created = await discordCreateGuildChannel(guildId, {
    name,
    type: DISCORD_CHANNEL_TYPE_GUILD_TEXT,
    parent_id: categoryId,
  });
  if (!created.ok) return { ok: false, error: created.error };
  const id = normalizeDiscordSnowflake(created.data.id);
  if (!id) return { ok: false, error: 'Discord returned an invalid channel id.' };
  return { ok: true, id };
}

function overwriteForTarget(
  overwrites: DiscordPermissionOverwrite[] | undefined,
  targetId: string,
  type: number,
): DiscordPermissionOverwrite | undefined {
  return (overwrites ?? []).find((o) => o.type === type && o.id === targetId);
}

export type DiscordChannelPermissionDiagnostic = {
  channelId: string;
  channelName: string;
  botSelfAccessSucceeded: boolean;
  everyoneDenyApplied: boolean;
  error?: string;
};

async function resolveBotUserId(): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const me = await discordGetCurrentUser();
  if (!me.ok) return { ok: false, error: me.error };
  const id = normalizeDiscordSnowflake(me.data.id);
  if (!id) return { ok: false, error: 'Discord /users/@me returned an invalid user id.' };
  return { ok: true, id };
}

async function repairStandardPermissions(
  channel: DiscordChannel,
  department: TaskDepartment | null,
  botUserId: string,
): Promise<{ errors: string[]; diagnostic: DiscordChannelPermissionDiagnostic }> {
  const diagnostic: DiscordChannelPermissionDiagnostic = {
    channelId: channel.id,
    channelName: channel.name,
    botSelfAccessSucceeded: false,
    everyoneDenyApplied: false,
  };
  const guildId = getDiscordGuildId();
  if (!guildId) {
    const error = 'DISCORD_GUILD_ID is not set.';
    diagnostic.error = error;
    return { errors: [error], diagnostic };
  }

  const fresh = await discordGetChannel(channel.id);
  const overwrites = fresh.ok ? fresh.data.permission_overwrites : channel.permission_overwrites;

  const botCurrent = overwriteForTarget(overwrites, botUserId, DISCORD_OVERWRITE_TYPE_MEMBER);
  const botMerged = mergeBotSelfAllowBits(
    parseDiscordBitfield(botCurrent?.allow),
    parseDiscordBitfield(botCurrent?.deny),
  );
  const botRes = await discordPutChannelOverwrite(
    channel.id,
    botUserId,
    DISCORD_OVERWRITE_TYPE_MEMBER,
    botMerged.allow,
    botMerged.deny,
  );
  if (!botRes.ok) {
    const error = `${channel.name} bot self-access: ${botRes.error}`;
    diagnostic.error = error;
    return { errors: [error], diagnostic };
  }
  diagnostic.botSelfAccessSucceeded = true;

  const errors: string[] = [];
  const everyone = overwriteForTarget(overwrites, guildId, DISCORD_OVERWRITE_TYPE_ROLE);
  const everyoneMerged = mergeEveryoneDenyView(
    parseDiscordBitfield(everyone?.allow),
    parseDiscordBitfield(everyone?.deny),
  );
  const everyoneRes = await discordPutChannelOverwrite(
    channel.id,
    guildId,
    DISCORD_OVERWRITE_TYPE_ROLE,
    everyoneMerged.allow,
    everyoneMerged.deny,
  );
  if (!everyoneRes.ok) {
    const error = `@everyone ${channel.name}: ${everyoneRes.error}`;
    errors.push(error);
    diagnostic.error = error;
  } else {
    diagnostic.everyoneDenyApplied = true;
  }

  for (const roleId of roleIdsForClientChannel(department)) {
    const current = overwriteForTarget(overwrites, roleId, DISCORD_OVERWRITE_TYPE_ROLE);
    const merged = mergeStaffAllowBits(
      parseDiscordBitfield(current?.allow),
      parseDiscordBitfield(current?.deny),
    );
    const res = await discordPutChannelOverwrite(
      channel.id,
      roleId,
      DISCORD_OVERWRITE_TYPE_ROLE,
      merged.allow,
      merged.deny,
    );
    if (!res.ok) errors.push(`role ${roleId} on ${channel.name}: ${res.error}`);
  }

  return { errors, diagnostic };
}

async function persistRoute(
  clientId: string,
  spec: ClientDiscordChannelSpec,
  channelId: string,
): Promise<string | null> {
  const saved = await upsertDiscordChannelRoute({
    clientId,
    department: spec.department,
    channelId,
  });
  if (!saved.ok) return saved.error ?? 'route upsert failed';
  return null;
}

async function loadClientRoutes(
  clientId: string,
): Promise<Map<TaskDepartment | 'default', string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('discord_channel_routes')
    .select('department, discord_channel_id')
    .eq('client_id', clientId);
  const map = new Map<TaskDepartment | 'default', string>();
  if (error) {
    logDiscord(`routes load: ${error.message}`);
    return map;
  }
  for (const row of data ?? []) {
    const channelId = normalizeDiscordSnowflake(row.discord_channel_id);
    if (!channelId) continue;
    const key = (row.department as TaskDepartment | null) ?? 'default';
    map.set(key, channelId);
  }
  return map;
}

async function ensureStandardChannels(
  clientId: string,
  categoryId: string,
): Promise<{
  created: number;
  linked: number;
  errors: string[];
  channelPermissionDiagnostics: DiscordChannelPermissionDiagnostic[];
}> {
  const errors: string[] = [];
  const channelPermissionDiagnostics: DiscordChannelPermissionDiagnostic[] = [];
  let created = 0;
  let linked = 0;
  let children = await listCategoryTextChannels(categoryId);
  const existingRoutes = await loadClientRoutes(clientId);

  const bot = await resolveBotUserId();
  if (!bot.ok) {
    errors.push(`bot user id: ${bot.error}`);
  }

  for (const spec of CLIENT_DISCORD_CHANNEL_SPECS) {
    const routeKey = spec.department ?? 'default';
    const storedId = existingRoutes.get(routeKey);
    let child: DiscordChannel | undefined;
    if (storedId) {
      const stored = children.find((ch) => ch.id === storedId);
      if (stored) child = stored;
      else {
        const fetched = await discordGetChannel(storedId);
        if (fetched.ok && (fetched.data.parent_id ?? null) === categoryId) {
          child = fetched.data;
        }
      }
    }
    if (!child) child = findChildByName(children, spec.name);

    if (!child) {
      const made = await createTextChannel(categoryId, spec.name);
      if (!made.ok) {
        errors.push(`${spec.name}: ${made.error}`);
        continue;
      }
      created += 1;
      await sleep(350);
      children = await listCategoryTextChannels(categoryId);
      child = findChildByName(children, spec.name) ?? {
        id: made.id,
        type: DISCORD_CHANNEL_TYPE_GUILD_TEXT,
        name: spec.name,
        parent_id: categoryId,
      };
    } else {
      linked += 1;
    }

    const channelId = normalizeDiscordSnowflake(child.id);
    if (!channelId) {
      errors.push(`${spec.name}: invalid channel id`);
      continue;
    }
    const routeErr = await persistRoute(clientId, spec, channelId);
    if (routeErr) errors.push(`${spec.name} route: ${routeErr}`);

    if (!bot.ok) {
      channelPermissionDiagnostics.push({
        channelId,
        channelName: child.name,
        botSelfAccessSucceeded: false,
        everyoneDenyApplied: false,
        error: bot.error,
      });
      continue;
    }

    const repaired = await repairStandardPermissions(child, spec.department, bot.id);
    errors.push(...repaired.errors);
    channelPermissionDiagnostics.push(repaired.diagnostic);
  }

  return { created, linked, errors, channelPermissionDiagnostics };
}

async function ensureCategoryForNewClient(
  clientId: string,
  clientName: string,
  existingCategoryId: string | null,
): Promise<{ ok: true; categoryId: string } | { ok: false; error: string }> {
  if (existingCategoryId) {
    const verified = await verifyCategory(existingCategoryId);
    if (verified.ok) return { ok: true, categoryId: existingCategoryId };
    if (verified.error.includes('Discord API 404')) {
      logDiscord(`stored category 404 for client ${clientId}; creating a replacement`);
    } else {
      return { ok: false, error: verified.error };
    }
  }

  const guildId = getDiscordGuildId();
  if (!guildId) return { ok: false, error: 'DISCORD_GUILD_ID is not set.' };
  const name = clientName.trim().slice(0, 100) || 'Client';
  const created = await discordCreateGuildChannel(guildId, {
    name,
    type: DISCORD_CHANNEL_TYPE_GUILD_CATEGORY,
  });
  if (!created.ok) return { ok: false, error: created.error };
  const categoryId = normalizeDiscordSnowflake(created.data.id);
  if (!categoryId) return { ok: false, error: 'Discord returned an invalid category id.' };
  const saved = await saveClientCategoryId(clientId, categoryId);
  if (!saved.ok) return { ok: false, error: saved.error ?? 'failed to store category id' };
  return { ok: true, categoryId };
}

export type DiscordClientProvisionResult = {
  ok: boolean;
  clientId: string;
  categoryId?: string;
  createdChannels: number;
  linkedChannels: number;
  errors: string[];
  channelPermissionDiagnostics: DiscordChannelPermissionDiagnostic[];
};

async function provisionClientDiscord(clientId: string): Promise<DiscordClientProvisionResult> {
  const empty: DiscordClientProvisionResult = {
    ok: false,
    clientId,
    createdChannels: 0,
    linkedChannels: 0,
    errors: [],
    channelPermissionDiagnostics: [],
  };
  if (!canProvisionDiscordClients()) {
    return { ...empty, errors: ['Discord bot token or guild id is not configured.'] };
  }
  const client = await loadClientDiscordState(clientId);
  if (!client) return { ...empty, errors: ['Client introuvable.'] };

  const category = await ensureCategoryForNewClient(clientId, client.name, client.categoryId);
  if (!category.ok) return { ...empty, errors: [category.error] };

  const channels = await ensureStandardChannels(clientId, category.categoryId);
  return {
    ok: channels.errors.length === 0,
    clientId,
    categoryId: category.categoryId,
    createdChannels: channels.created,
    linkedChannels: channels.linked,
    errors: channels.errors,
    channelPermissionDiagnostics: channels.channelPermissionDiagnostics,
  };
}

export function scheduleClientDiscordProvision(clientId: string | null | undefined): void {
  const id = (clientId ?? '').trim();
  if (!id || !canProvisionDiscordClients()) return;
  const work = () =>
    provisionClientDiscord(id).then((res) => {
      if (!res.ok) logDiscord(`provision ${id}: ${res.errors.join('; ') || 'failed'}`);
    }).catch((e) => {
      logDiscord(e instanceof Error ? e.message : 'client provision failed');
    });
  try {
    after(work);
  } catch {
    void work();
  }
}

export async function linkExistingClientDiscordCategory(input: {
  clientId: string;
  categoryId: string;
}): Promise<DiscordClientProvisionResult> {
  const clientId = input.clientId.trim();
  const categoryId = normalizeDiscordSnowflake(input.categoryId);
  const empty: DiscordClientProvisionResult = {
    ok: false,
    clientId,
    createdChannels: 0,
    linkedChannels: 0,
    errors: [],
    channelPermissionDiagnostics: [],
  };
  if (!clientId) return { ...empty, errors: ['client_id is required.'] };
  if (!categoryId) return { ...empty, errors: ['category_id must be a Discord snowflake.'] };
  if (!canProvisionDiscordClients()) {
    return { ...empty, errors: ['Discord bot token or guild id is not configured.'] };
  }

  const client = await loadClientDiscordState(clientId);
  if (!client) return { ...empty, errors: ['Client introuvable.'] };

  if (client.categoryId && client.categoryId !== categoryId) {
    return {
      ...empty,
      errors: ['This SUPRA client is already linked to a different Discord category.'],
    };
  }

  const other = await categoryOwnedByOtherClient(categoryId, clientId);
  if (other) {
    return { ...empty, errors: [`Category already linked to ${other}.`] };
  }

  const verified = await verifyCategory(categoryId);
  if (!verified.ok) return { ...empty, errors: [verified.error] };

  const saved = await saveClientCategoryId(clientId, categoryId);
  if (!saved.ok) return { ...empty, errors: [saved.error ?? 'failed to store category id'] };

  const channels = await ensureStandardChannels(clientId, categoryId);
  return {
    ok: channels.errors.length === 0,
    clientId,
    categoryId,
    createdChannels: channels.created,
    linkedChannels: channels.linked,
    errors: channels.errors,
    channelPermissionDiagnostics: channels.channelPermissionDiagnostics,
  };
}
