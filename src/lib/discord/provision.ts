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
  INTERNAL_DISCORD_CATEGORY_SPECS,
  botSelfOverwriteIncludesManagement,
  discordNamesMatch,
  isDiscordCleanupCandidate,
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
  discordModifyGuildChannelPositions,
  discordPatchChannel,
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

function findChildByName(children: DiscordChannel[], name: string): DiscordChannel | undefined {
  return children.find(
    (ch) => ch.type === DISCORD_CHANNEL_TYPE_GUILD_TEXT && discordNamesMatch(ch.name, name),
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
  position: number,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const guildId = getDiscordGuildId();
  if (!guildId) return { ok: false, error: 'DISCORD_GUILD_ID is not set.' };
  const created = await discordCreateGuildChannel(guildId, {
    name,
    type: DISCORD_CHANNEL_TYPE_GUILD_TEXT,
    parent_id: categoryId,
    position,
  });
  if (!created.ok) return { ok: false, error: created.error };
  const id = normalizeDiscordSnowflake(created.data.id);
  if (!id) return { ok: false, error: 'Discord returned an invalid channel id.' };
  return { ok: true, id };
}

async function renameChannelIfNeeded(
  channel: DiscordChannel,
  expectedName: string,
): Promise<{ channel: DiscordChannel; error?: string }> {
  if (discordNamesMatch(channel.name, expectedName)) return { channel };
  const patched = await discordPatchChannel(channel.id, { name: expectedName });
  if (!patched.ok) {
    return { channel, error: `${channel.name} rename: ${patched.error}` };
  }
  return { channel: { ...channel, ...patched.data, name: expectedName } };
}

async function applyStandardClientChannelOrder(categoryId: string): Promise<string[]> {
  const guildId = getDiscordGuildId();
  if (!guildId) return ['DISCORD_GUILD_ID is not set.'];
  const listed = await discordListGuildChannels(guildId);
  if (!listed.ok) return [`channel order: ${listed.error}`];

  const children = (listed.data ?? []).filter(
    (ch) =>
      ch.type === DISCORD_CHANNEL_TYPE_GUILD_TEXT &&
      (ch.parent_id ?? null) === categoryId,
  );
  const used = new Set<string>();
  const ordered: DiscordChannel[] = [];
  for (const spec of CLIENT_DISCORD_CHANNEL_SPECS) {
    const match = children.find((ch) => !used.has(ch.id) && discordNamesMatch(ch.name, spec.name));
    if (!match) continue;
    ordered.push(match);
    used.add(match.id);
  }
  const extras = children
    .filter((ch) => !used.has(ch.id))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
  ordered.push(...extras);

  const alreadyOrdered = ordered.every((ch, i) => (ch.position ?? i) === i);
  if (alreadyOrdered || ordered.length === 0) return [];

  const payload = ordered.map((ch, position) => ({
    id: ch.id,
    position,
    parent_id: categoryId,
  }));
  const moved = await discordModifyGuildChannelPositions(guildId, payload);
  if (moved.ok) return [];
  return [`channel order: ${moved.error}`];
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
  botManagementPermissionsIncluded: boolean;
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
    botManagementPermissionsIncluded: false,
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

  const confirmed = await discordGetChannel(channel.id);
  const storedBot = overwriteForTarget(
    confirmed.ok ? confirmed.data.permission_overwrites : undefined,
    botUserId,
    DISCORD_OVERWRITE_TYPE_MEMBER,
  );
  diagnostic.botManagementPermissionsIncluded = storedBot
    ? botSelfOverwriteIncludesManagement(
        parseDiscordBitfield(storedBot.allow),
        parseDiscordBitfield(storedBot.deny),
      )
    : botSelfOverwriteIncludesManagement(botMerged.allow, botMerged.deny);
  if (!diagnostic.botManagementPermissionsIncluded) {
    const error = `${channel.name} bot self-access: MANAGE_ROLES/MANAGE_CHANNELS missing after overwrite`;
    diagnostic.error = error;
    return { errors: [error], diagnostic };
  }

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

  for (const [index, spec] of CLIENT_DISCORD_CHANNEL_SPECS.entries()) {
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
      const made = await createTextChannel(categoryId, spec.name, index);
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
        position: index,
      };
    } else {
      linked += 1;
    }

    const channelId = normalizeDiscordSnowflake(child.id);
    if (!channelId) {
      errors.push(`${spec.name}: invalid channel id`);
      continue;
    }
    const renamed = await renameChannelIfNeeded(child, spec.name);
    if (renamed.error) errors.push(renamed.error);
    child = renamed.channel;
    const renamedChild = child;
    children = children.map((ch) => (ch.id === renamedChild.id ? renamedChild : ch));

    const routeErr = await persistRoute(clientId, spec, channelId);
    if (routeErr) errors.push(`${spec.name} route: ${routeErr}`);

    if (!bot.ok) {
      channelPermissionDiagnostics.push({
        channelId,
        channelName: child.name,
        botSelfAccessSucceeded: false,
        botManagementPermissionsIncluded: false,
        everyoneDenyApplied: false,
        error: bot.error,
      });
      continue;
    }

    const repaired = await repairStandardPermissions(child, spec.department, bot.id);
    errors.push(...repaired.errors);
    channelPermissionDiagnostics.push(repaired.diagnostic);
  }

  errors.push(...(await applyStandardClientChannelOrder(categoryId)));

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

export type DiscordLayoutChannel = {
  id: string;
  name: string;
  parentId: string | null;
};

export type DiscordGuildLayoutReport = {
  standardChannelOrder: string[];
  linkedClients: {
    clientId: string;
    clientName: string;
    categoryId: string;
    channels: string[];
    missing: string[];
    extras: string[];
    orderMatches: boolean;
  }[];
  internalCategories: {
    name: string;
    expected: string[];
    found: boolean;
    channels: string[];
    orderMatches: boolean;
  }[];
  cleanupCandidates: DiscordLayoutChannel[];
};

export async function inspectDiscordGuildLayout(): Promise<
  { ok: true; report: DiscordGuildLayoutReport } | { ok: false; error: string }
> {
  const guildId = getDiscordGuildId();
  if (!getDiscordBotToken() || !guildId) {
    return { ok: false, error: 'Discord bot token or guild id is not configured.' };
  }
  const listed = await discordListGuildChannels(guildId);
  if (!listed.ok) return { ok: false, error: listed.error };
  const channels = listed.data ?? [];

  const admin = createAdminClient();
  const { data: clients } = await admin
    .from('clients')
    .select('id, name, discord_category_id')
    .not('discord_category_id', 'is', null);

  const linkedClients = (clients ?? []).flatMap((row) => {
    const categoryId = normalizeDiscordSnowflake(row.discord_category_id);
    if (!categoryId) return [];
    const children = channels
      .filter(
        (ch) =>
          ch.type === DISCORD_CHANNEL_TYPE_GUILD_TEXT &&
          (ch.parent_id ?? null) === categoryId,
      )
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
    const names = children.map((ch) => ch.name);
    const missing = CLIENT_DISCORD_CHANNEL_SPECS.filter(
      (spec) => !children.some((ch) => discordNamesMatch(ch.name, spec.name)),
    ).map((spec) => spec.name);
    const extras = children
      .filter((ch) => !CLIENT_DISCORD_CHANNEL_SPECS.some((spec) => discordNamesMatch(ch.name, spec.name)))
      .map((ch) => ch.name);
    const expected = CLIENT_DISCORD_CHANNEL_SPECS.map((spec) => spec.name);
    const prefix = names.slice(0, expected.length);
    const orderMatches =
      missing.length === 0 && prefix.every((name, i) => discordNamesMatch(name, expected[i] ?? ''));
    return [
      {
        clientId: row.id,
        clientName: String(row.name ?? 'Client'),
        categoryId,
        channels: names,
        missing,
        extras,
        orderMatches,
      },
    ];
  });

  const internalCategories = INTERNAL_DISCORD_CATEGORY_SPECS.map((spec) => {
    const category = channels.find(
      (ch) =>
        ch.type === DISCORD_CHANNEL_TYPE_GUILD_CATEGORY && discordNamesMatch(ch.name, spec.name),
    );
    const children = category
      ? channels
          .filter(
            (ch) =>
              ch.type === DISCORD_CHANNEL_TYPE_GUILD_TEXT &&
              (ch.parent_id ?? null) === category.id,
          )
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id))
      : [];
    const childNames = children.map((ch) => ch.name);
    const orderMatches =
      Boolean(category) &&
      spec.channels.length === childNames.length &&
      spec.channels.every((name, i) => discordNamesMatch(childNames[i] ?? '', name));
    return {
      name: spec.name,
      expected: [...spec.channels],
      found: Boolean(category),
      channels: childNames,
      orderMatches,
    };
  });

  const cleanupCandidates = channels.filter(isDiscordCleanupCandidate).map((ch) => ({
    id: ch.id,
    name: ch.name,
    parentId: ch.parent_id ?? null,
  }));

  return {
    ok: true,
    report: {
      standardChannelOrder: CLIENT_DISCORD_CHANNEL_SPECS.map((spec) => spec.name),
      linkedClients,
      internalCategories,
      cleanupCandidates,
    },
  };
}

export async function syncLinkedClientChannelLayout(clientId?: string): Promise<{
  ok: boolean;
  clientId: string;
  categoryId: string | null;
  renamed: number;
  errors: string[];
}> {
  const empty = {
    ok: false,
    clientId: clientId ?? '',
    categoryId: null as string | null,
    renamed: 0,
    errors: [] as string[],
  };
  if (!clientId) return { ...empty, errors: ['client_id is required.'] };
  if (!canProvisionDiscordClients()) {
    return { ...empty, errors: ['Discord bot token or guild id is not configured.'] };
  }
  const client = await loadClientDiscordState(clientId);
  if (!client) return { ...empty, errors: ['Client introuvable.'] };
  if (!client.categoryId) {
    return { ...empty, errors: ['Client has no linked Discord category.'] };
  }

  const errors: string[] = [];
  let renamed = 0;
  const children = await listCategoryTextChannels(client.categoryId);
  const existingRoutes = await loadClientRoutes(clientId);

  for (const spec of CLIENT_DISCORD_CHANNEL_SPECS) {
    const routeKey = spec.department ?? 'default';
    const storedId = existingRoutes.get(routeKey);
    let child = storedId ? children.find((ch) => ch.id === storedId) : undefined;
    if (!child) child = findChildByName(children, spec.name);
    if (!child) {
      errors.push(`${spec.name}: missing`);
      continue;
    }
    const before = child.name;
    const result = await renameChannelIfNeeded(child, spec.name);
    if (result.error) errors.push(result.error);
    else if (!discordNamesMatch(before, spec.name)) renamed += 1;
  }

  errors.push(...(await applyStandardClientChannelOrder(client.categoryId)));
  return {
    ok: errors.length === 0,
    clientId,
    categoryId: client.categoryId,
    renamed,
    errors,
  };
}

export async function syncAllLinkedClientChannelLayouts(): Promise<{
  ok: boolean;
  results: Awaited<ReturnType<typeof syncLinkedClientChannelLayout>>[];
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('clients')
    .select('id')
    .not('discord_category_id', 'is', null);
  if (error) return { ok: false, results: [{ ok: false, clientId: '', categoryId: null, renamed: 0, errors: [error.message] }] };
  const results = [];
  for (const row of data ?? []) {
    results.push(await syncLinkedClientChannelLayout(row.id));
    await sleep(350);
  }
  return { ok: results.every((r) => r.ok), results };
}
