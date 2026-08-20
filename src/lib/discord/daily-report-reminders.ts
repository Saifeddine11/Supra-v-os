import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  casablancaHourMinute,
  casablancaWallTimeUtcMs,
  casablancaYmd,
} from '@/lib/dates/casablanca';
import {
  getDiscordGuildId,
  getDiscordTeamGeneralChannelId,
  getDiscordTeamReportChannelId,
  isDiscordDailyReportReminderEnabled,
  normalizeDiscordSnowflake,
} from '@/lib/discord/config';
import {
  DISCORD_CHANNEL_TYPE_GUILD_FORUM,
  DISCORD_CHANNEL_TYPE_GUILD_MEDIA,
} from '@/lib/discord/channels';
import { getDiscordStaffRoleId } from '@/lib/discord/roles';
import {
  discordCreateChannelMessage,
  discordGetChannel,
  discordGetCurrentUser,
  discordListActiveGuildThreads,
  discordListPublicArchivedThreads,
  type DiscordChannel,
} from '@/lib/discord/rest';

/** Sentinel row in discord_reminder_deliveries (not a task/video id). */
const DAILY_REPORT_ENTITY_ID = '00000000-0000-0000-0000-00000000d001';

const ASK_MINUTES = 18 * 60;
const FOLLOW_MINUTES = 18 * 60 + 30;
const WINDOW_END_MINUTES = 20 * 60;

export type DailyReportCronResult = {
  occurrenceDate: string;
  casablancaHm: string;
  ask: 'sent' | 'already_sent' | 'outside_window' | 'disabled' | 'skipped';
  followUp: 'sent' | 'all_submitted' | 'already_sent' | 'outside_window' | 'disabled' | 'skipped';
  expected: number;
  submitted: number;
  missingNames: string[];
  errors: string[];
};

type ExpectedStaff = {
  id: string;
  full_name: string;
  discord_user_id: string;
};

function logDaily(message: string): void {
  console.error(`[discord-daily-report] ${message}`);
}

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '23505' || /duplicate key|unique constraint/i.test(error.message ?? '');
}

async function claimDelivery(
  reminderType: 'daily_report_ask' | 'daily_report_missing',
  occurrenceDate: string,
): Promise<'won' | 'lost'> {
  const admin = createAdminClient();
  const { error } = await admin.from('discord_reminder_deliveries').insert({
    entity_type: 'agency',
    entity_id: DAILY_REPORT_ENTITY_ID,
    reminder_type: reminderType,
    occurrence_date: occurrenceDate,
  });
  if (!error) return 'won';
  if (isUniqueViolation(error)) return 'lost';
  logDaily(`claim ${reminderType}: ${error.message}`);
  return 'lost';
}

async function releaseDelivery(
  reminderType: 'daily_report_ask' | 'daily_report_missing',
  occurrenceDate: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('discord_reminder_deliveries')
    .delete()
    .eq('entity_type', 'agency')
    .eq('entity_id', DAILY_REPORT_ENTITY_ID)
    .eq('reminder_type', reminderType)
    .eq('occurrence_date', occurrenceDate);
  if (error) logDaily(`release ${reminderType}: ${error.message}`);
}

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function threadCreatedAtMs(thread: DiscordChannel): number | null {
  const raw = thread.thread_metadata?.create_timestamp;
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

async function loadExpectedStaff(botUserId: string | null): Promise<ExpectedStaff[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('employees')
    .select('id, full_name, discord_user_id')
    .eq('is_active', true)
    .is('archived_at', null)
    .not('discord_user_id', 'is', null);

  if (error) {
    logDaily(`employees: ${error.message}`);
    return [];
  }

  const out: ExpectedStaff[] = [];
  for (const row of data ?? []) {
    const snow = normalizeDiscordSnowflake(row.discord_user_id);
    if (!snow) continue;
    if (botUserId && snow === botUserId) continue;
    out.push({
      id: row.id,
      full_name: row.full_name,
      discord_user_id: snow,
    });
  }
  return out;
}

function collectForumThreads(
  threads: DiscordChannel[] | undefined,
  forumId: string,
  cutoffMs: number,
): Map<string, true> {
  const submitted = new Map<string, true>();
  for (const thread of threads ?? []) {
    if (thread.parent_id !== forumId) continue;
    const created = threadCreatedAtMs(thread);
    if (created === null || created < cutoffMs) continue;
    const owner = normalizeDiscordSnowflake(thread.owner_id);
    if (!owner) continue;
    submitted.set(owner, true);
  }
  return submitted;
}

async function loadSubmittedOwnerIds(
  guildId: string,
  forumId: string,
  cutoffMs: number,
): Promise<{ owners: Set<string>; error?: string }> {
  const owners = new Set<string>();

  const active = await discordListActiveGuildThreads(guildId);
  if (!active.ok) {
    return { owners, error: `active threads: ${active.error}` };
  }
  for (const id of collectForumThreads(active.data.threads, forumId, cutoffMs).keys()) {
    owners.add(id);
  }

  let before: string | undefined;
  for (let page = 0; page < 3; page += 1) {
    const archived = await discordListPublicArchivedThreads(forumId, before);
    if (!archived.ok) {
      if (page === 0) return { owners, error: `archived threads: ${archived.error}` };
      break;
    }
    const threads = archived.data.threads ?? [];
    for (const id of collectForumThreads(threads, forumId, cutoffMs).keys()) {
      owners.add(id);
    }
    if (!archived.data.has_more || threads.length === 0) break;
    const last = threads[threads.length - 1];
    const nextBefore =
      last.thread_metadata?.archive_timestamp || last.thread_metadata?.create_timestamp;
    if (!nextBefore) break;
    before = nextBefore;
  }

  return { owners };
}

async function postAsk(generalChannelId: string, teamRoleId: string, reportChannelId: string): Promise<boolean> {
  const posted = await discordCreateChannelMessage(generalChannelId, {
    content:
      `📝 Compte rendu de fin de journée\n\n` +
      `<@&${teamRoleId}> merci d’envoyer votre compte rendu de la journée dans <#${reportChannelId}>.`,
    allowed_mentions: { parse: [], roles: [teamRoleId] },
  });
  if (!posted.ok) {
    logDaily(`ask post: ${posted.error}`);
    return false;
  }
  return true;
}

async function postMissing(
  generalChannelId: string,
  reportChannelId: string,
  missing: ExpectedStaff[],
): Promise<boolean> {
  const mentions = missing.map((e) => `<@${e.discord_user_id}>`).join(' ');
  const posted = await discordCreateChannelMessage(generalChannelId, {
    content:
      `⏰ Compte rendu manquant\n\n` +
      `${mentions} merci d’envoyer votre compte rendu dans <#${reportChannelId}>.`,
    allowed_mentions: { parse: [], users: missing.map((e) => e.discord_user_id) },
  });
  if (!posted.ok) {
    logDaily(`missing post: ${posted.error}`);
    return false;
  }
  return true;
}

export async function runDiscordDailyReportReminders(
  now: Date = new Date(),
): Promise<DailyReportCronResult> {
  const occurrenceDate = casablancaYmd(now);
  const { hour, minute } = casablancaHourMinute(now);
  const hm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const empty: DailyReportCronResult = {
    occurrenceDate,
    casablancaHm: hm,
    ask: 'skipped',
    followUp: 'skipped',
    expected: 0,
    submitted: 0,
    missingNames: [],
    errors: [],
  };

  if (!isDiscordDailyReportReminderEnabled()) {
    return { ...empty, ask: 'disabled', followUp: 'disabled' };
  }

  const generalId = getDiscordTeamGeneralChannelId();
  const reportId = getDiscordTeamReportChannelId();
  const teamRoleId = getDiscordStaffRoleId('team');
  const guildId = getDiscordGuildId();
  const errors: string[] = [];

  if (!generalId || !reportId || !teamRoleId || !guildId) {
    const missing: string[] = [];
    if (!generalId) missing.push('DISCORD_TEAM_GENERAL_CHANNEL_ID is missing');
    if (!reportId) missing.push('DISCORD_TEAM_REPORT_CHANNEL_ID is missing');
    if (!teamRoleId) missing.push('DISCORD_ROLE_TEAM is missing');
    if (!guildId) missing.push('DISCORD_GUILD_ID is missing');
    missing.forEach(logDaily);
    return { ...empty, errors: missing };
  }

  const nowMin = minutesSinceMidnight(hour, minute);
  const inAsk = nowMin >= ASK_MINUTES && nowMin < FOLLOW_MINUTES;
  const inFollow = nowMin >= FOLLOW_MINUTES && nowMin < WINDOW_END_MINUTES;
  if (!inAsk && !inFollow) {
    return { ...empty, ask: 'outside_window', followUp: 'outside_window' };
  }

  const me = await discordGetCurrentUser();
  const botUserId = me.ok ? normalizeDiscordSnowflake(me.data.id) : null;
  if (!me.ok) logDaily(`bot user: ${me.error}`);

  const staff = await loadExpectedStaff(botUserId);
  const cutoffMs = casablancaWallTimeUtcMs(occurrenceDate, 18, 0);
  if (!Number.isFinite(cutoffMs)) {
    errors.push('could not resolve 18:00 Africa/Casablanca cutoff');
    return { ...empty, errors };
  }

  let ask: DailyReportCronResult['ask'] = 'outside_window';
  let followUp: DailyReportCronResult['followUp'] = 'outside_window';
  let submitted = 0;
  let missingNames: string[] = [];

  if (inAsk) {
    followUp = 'outside_window';
    const claimed = await claimDelivery('daily_report_ask', occurrenceDate);
    if (claimed === 'lost') {
      ask = 'already_sent';
    } else {
      const ok = await postAsk(generalId, teamRoleId, reportId);
      if (!ok) {
        await releaseDelivery('daily_report_ask', occurrenceDate);
        errors.push('failed to post 18:00 ask');
        ask = 'skipped';
      } else {
        ask = 'sent';
      }
    }
  }

  if (inFollow) {
    ask = ask === 'sent' ? 'sent' : 'outside_window';
    const forum = await discordGetChannel(reportId);
    if (!forum.ok) {
      errors.push(`report channel: ${forum.error}`);
      return {
        occurrenceDate,
        casablancaHm: hm,
        ask,
        followUp: 'skipped',
        expected: staff.length,
        submitted: 0,
        missingNames: [],
        errors,
      };
    }
    if (
      forum.data.type !== DISCORD_CHANNEL_TYPE_GUILD_FORUM &&
      forum.data.type !== DISCORD_CHANNEL_TYPE_GUILD_MEDIA
    ) {
      errors.push(`report channel is type ${forum.data.type}, expected Discord forum (15) or media (16)`);
      return {
        occurrenceDate,
        casablancaHm: hm,
        ask,
        followUp: 'skipped',
        expected: staff.length,
        submitted: 0,
        missingNames: [],
        errors,
      };
    }

    const listed = await loadSubmittedOwnerIds(guildId, reportId, cutoffMs);
    if (listed.error) errors.push(listed.error);

    const missing = staff.filter((e) => !listed.owners.has(e.discord_user_id));
    submitted = staff.length - missing.length;
    missingNames = missing.map((e) => e.full_name);

    if (missing.length === 0) {
      const claimed = await claimDelivery('daily_report_missing', occurrenceDate);
      followUp = claimed === 'lost' ? 'already_sent' : 'all_submitted';
      return {
        occurrenceDate,
        casablancaHm: hm,
        ask,
        followUp,
        expected: staff.length,
        submitted,
        missingNames: [],
        errors,
      };
    }

    const claimed = await claimDelivery('daily_report_missing', occurrenceDate);
    if (claimed === 'lost') {
      followUp = 'already_sent';
    } else {
      const ok = await postMissing(generalId, reportId, missing);
      if (!ok) {
        await releaseDelivery('daily_report_missing', occurrenceDate);
        errors.push('failed to post 18:30 follow-up');
        followUp = 'skipped';
      } else {
        followUp = 'sent';
      }
    }
  }

  return {
    occurrenceDate,
    casablancaHm: hm,
    ask,
    followUp,
    expected: staff.length,
    submitted,
    missingNames,
    errors,
  };
}
