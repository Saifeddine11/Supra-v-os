import 'server-only';

import { PRIORITY_MAP, TASK_STATUS_MAP } from '@/types/domain';
import type { TaskPriority, TaskStatus } from '@/types/database';

const EMBED_COLOR = 0xff3d0a;

function fieldValue(raw: string | null | undefined, fallback = '—'): string {
  const t = (raw ?? '').trim();
  if (!t) return fallback;
  return t.length > 1024 ? `${t.slice(0, 1021)}…` : t;
}

function formatDeadline(iso: string | null): string {
  if (!iso) return 'Sans échéance';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sans échéance';
  return d.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildTaskDiscordPayload(input: {
  title: string;
  clientName: string | null;
  assigneeNames: string[];
  mentionIds: string[];
  deadline: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  taskUrl: string | null;
}): Record<string, unknown> {
  const mentions = input.mentionIds.map((id) => `<@${id}>`).join(' ');
  const assigneeLabel =
    input.assigneeNames.length > 0 ? input.assigneeNames.join(', ') : 'Non assigné';
  const statusLabel = TASK_STATUS_MAP[input.status]?.label ?? input.status;
  const priorityLabel = PRIORITY_MAP[input.priority]?.label ?? input.priority;

  return {
    content: mentions || undefined,
    allowed_mentions: input.mentionIds.length
      ? { parse: [], users: input.mentionIds }
      : { parse: [] },
    embeds: [
      {
        title: fieldValue(input.title, 'Tâche'),
        url: input.taskUrl || undefined,
        color: EMBED_COLOR,
        fields: [
          { name: 'Client', value: fieldValue(input.clientName, 'Interne'), inline: true },
          { name: 'Assigné(s)', value: fieldValue(assigneeLabel), inline: true },
          { name: 'Échéance', value: formatDeadline(input.deadline), inline: true },
          { name: 'Priorité', value: fieldValue(priorityLabel), inline: true },
          { name: 'Statut', value: fieldValue(statusLabel), inline: true },
        ],
        footer: { text: 'SUPRA' },
      },
    ],
  };
}

export function buildDiscordTestPayload(): Record<string, unknown> {
  return {
    content: 'Message de test SUPRA → Discord (aucune tâche enregistrée).',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: 'Test d’intégration SUPRA',
        color: EMBED_COLOR,
        description:
          'Si vous voyez ce message, le bot token et l’ID de salon sont valides. Les tâches réelles ne seront postées qu’après configuration des routes et DISCORD_TASK_SYNC_ENABLED=true.',
        footer: { text: 'SUPRA' },
      },
    ],
  };
}

export function buildDeadlineReminderPayload(input: {
  kind: 'soon' | 'overdue';
  title: string;
  mentionIds: string[];
  taskUrl: string | null;
}): Record<string, unknown> {
  const mentions = input.mentionIds.map((id) => `<@${id}>`).join(' ');
  const heading =
    input.kind === 'overdue' ? 'Tâche en retard' : 'Échéance sous 24 h';
  const line = input.taskUrl ? `[${input.title}](${input.taskUrl})` : input.title;
  return {
    content: [mentions, `**${heading}** — ${line}`].filter(Boolean).join(' '),
    allowed_mentions: input.mentionIds.length
      ? { parse: [], users: input.mentionIds }
      : { parse: [] },
  };
}

export function buildTaskDueTodayReminderPayload(input: {
  title: string;
  mentionIds: string[];
  taskUrl: string | null;
}): Record<string, unknown> {
  const mentions = input.mentionIds.map((id) => `<@${id}>`).join(' ');
  const title = input.taskUrl ? `[${input.title}](${input.taskUrl})` : `“${input.title}”`;
  const who = mentions || 'l’équipe';
  return {
    content: `⏰ ${who} — échéance aujourd’hui pour ${title}. La tâche n’est pas encore terminée. Merci de la clôturer ou de mettre à jour son statut.`,
    allowed_mentions: input.mentionIds.length
      ? { parse: [], users: input.mentionIds }
      : { parse: [] },
  };
}

export function buildTaskOverdueReminderPayload(input: {
  title: string;
  mentionIds: string[];
  taskUrl: string | null;
}): Record<string, unknown> {
  const mentions = input.mentionIds.map((id) => `<@${id}>`).join(' ');
  const title = input.taskUrl ? `[${input.title}](${input.taskUrl})` : `“${input.title}”`;
  const who = mentions || 'l’équipe';
  return {
    content: `⏰ ${who} — échéance dépassée pour ${title}. La tâche n’est pas encore terminée. Merci de la clôturer ou de mettre à jour son statut.`,
    allowed_mentions: input.mentionIds.length
      ? { parse: [], users: input.mentionIds }
      : { parse: [] },
  };
}

export function buildWaitingTeamValidationPayload(input: {
  title: string;
  approverUserId: string | null;
  assigneeMentionIds: string[];
  taskUrl: string | null;
}): Record<string, unknown> {
  const users = [
    ...new Set([input.approverUserId, ...input.assigneeMentionIds].filter((id): id is string => Boolean(id))),
  ];
  const approver = input.approverUserId ? `<@${input.approverUserId}>` : 'Direction';
  const assignees =
    input.assigneeMentionIds.length > 0
      ? input.assigneeMentionIds.map((id) => `<@${id}>`).join(' ')
      : 'l’assigné';
  const title = input.taskUrl ? `[${input.title}](${input.taskUrl})` : `“${input.title}”`;
  return {
    content: `✅ ${approver} — validation requise pour ${title}. ${assignees} attend${input.assigneeMentionIds.length > 1 ? 'ent' : ''} ton OK avant de passer la tâche en Terminée.`,
    allowed_mentions: users.length ? { parse: [], users } : { parse: [] },
  };
}

function checklistBlock(items: string[]): string {
  return items.map((item) => `☐ ${item}`).join('\n');
}

export function buildShootingJMinus1Payload(input: {
  title: string;
  videoUrl: string | null;
  mentionUserIds: string[];
  mentionRoleIds: string[];
  locationLine: string | null;
  contactLine: string | null;
}): Record<string, unknown> {
  const userMentions = input.mentionUserIds.map((id) => `<@${id}>`).join(' ');
  const roleMentions = input.mentionRoleIds.map((id) => `<@&${id}>`).join(' ');
  const who = [userMentions, roleMentions].filter(Boolean).join(' ');
  const title = input.videoUrl ? `[${input.title}](${input.videoUrl})` : `“${input.title}”`;
  const extra: string[] = [];
  if (input.locationLine) extra.push(`☐ lieu / adresse confirmés — ${input.locationLine}`);
  if (input.contactLine) extra.push(`☐ contact sur place — ${input.contactLine}`);
  const body = checklistBlock([
    'script / brief validé',
    'shot list prête',
    'horaires confirmés',
    ...extra,
    'talents / figurants confirmés si applicable',
    'produits / accessoires prêts',
    'tenues / maquillage si applicable',
    'caméra + objectifs',
    'micros / audio',
    'lumières',
    'trépied / gimbal',
    'batteries chargées + batteries de secours',
    'cartes mémoire disponibles / vidées',
    'chargeurs / câbles / adaptateurs',
    'transport / logistique',
  ]);
  return {
    content: [who, `🎬 Tournage demain — ${title}`, '', body].filter((line) => line !== undefined).join('\n'),
    allowed_mentions: {
      parse: [],
      users: input.mentionUserIds,
      roles: input.mentionRoleIds,
    },
  };
}

export function buildShootingDayPayload(input: {
  title: string;
  videoUrl: string | null;
  mentionUserIds: string[];
  mentionRoleIds: string[];
  locationLine: string | null;
  contactLine: string | null;
}): Record<string, unknown> {
  const userMentions = input.mentionUserIds.map((id) => `<@${id}>`).join(' ');
  const roleMentions = input.mentionRoleIds.map((id) => `<@&${id}>`).join(' ');
  const who = [userMentions, roleMentions].filter(Boolean).join(' ');
  const title = input.videoUrl ? `[${input.title}](${input.videoUrl})` : `“${input.title}”`;
  const extra: string[] = [];
  if (input.locationLine) extra.push(`☐ adresse — ${input.locationLine}`);
  if (input.contactLine) extra.push(`☐ contact — ${input.contactLine}`);
  const body = checklistBlock([
    'caméra',
    'objectifs',
    'batteries chargées',
    'batteries de secours',
    'cartes mémoire vidées / formatées',
    'micros + batteries',
    'lumières',
    'trépied / gimbal',
    'chargeurs',
    'powerbank',
    'câbles / adaptateurs',
    'script / shot list',
    'produits / accessoires',
    ...extra,
  ]);
  return {
    content: [who, `🎥 Tournage aujourd’hui — check matériel avant départ — ${title}`, '', body]
      .filter((line) => line !== undefined)
      .join('\n'),
    allowed_mentions: {
      parse: [],
      users: input.mentionUserIds,
      roles: input.mentionRoleIds,
    },
  };
}

export function buildMorningDigestPayload(input: {
  recipientName: string;
  mentionId: string | null;
  dueToday: string[];
  overdue: string[];
  urgent: string[];
  tasksUrl: string;
}): Record<string, unknown> {
  const mention = input.mentionId ? `<@${input.mentionId}>` : input.recipientName;
  const bullets = (items: string[]) =>
    items.length ? items.map((t) => `• ${t}`).join('\n') : '—';
  return {
    content: `${mention} — rappel matinal`,
    allowed_mentions: input.mentionId ? { parse: [], users: [input.mentionId] } : { parse: [] },
    embeds: [
      {
        title: `Rappel matinal — ${input.recipientName}`,
        url: input.tasksUrl,
        color: EMBED_COLOR,
        fields: [
          { name: 'Aujourd’hui', value: bullets(input.dueToday).slice(0, 1024), inline: false },
          { name: 'En retard', value: bullets(input.overdue).slice(0, 1024), inline: false },
          { name: 'Urgent', value: bullets(input.urgent).slice(0, 1024), inline: false },
        ],
        footer: { text: 'SUPRA' },
      },
    ],
  };
}
