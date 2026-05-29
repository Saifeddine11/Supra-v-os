import 'server-only';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AiScopedCalendarPayload } from '@/lib/ai/context-schema';
import {
  SUPAI_EMPTY_CALENDAR_GLOBAL,
  SUPAI_EMPTY_CALENDAR_PERSONAL,
} from '@/lib/ai/supai-copy';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

function formatPeriodHeader(payload: AiScopedCalendarPayload): string {
  const label = payload.periodLabel.trim();
  const lower = label.toLowerCase();
  if (
    lower === "aujourd'hui" ||
    lower === 'demain' ||
    lower.startsWith('cette ') ||
    lower.startsWith('la semaine') ||
    lower.startsWith('ce mois') ||
    lower.startsWith('le mois')
  ) {
    return payload.scopeMode === 'global'
      ? `Pour ${label}, voici le calendrier opérationnel de l'équipe :`
      : `Pour ${label}, voici ce qui est prévu dans votre périmètre :`;
  }

  const parsed = new Date(payload.startDate);
  const dateLabel = Number.isNaN(parsed.getTime())
    ? label
    : format(parsed, 'd MMMM yyyy', { locale: fr });

  return payload.scopeMode === 'global'
    ? `Pour le ${dateLabel}, voici le calendrier opérationnel de l'équipe :`
    : `Pour le ${dateLabel}, voici ce qui est prévu dans votre périmètre :`;
}

function renderTask(task: AiScopedCalendarPayload['tasks'][number], index: number): string {
  const lines = [
    `${index}. ${task.title}${task.clientName ? ` — ${task.clientName}` : ''}`,
  ];
  if (task.assigneeNames) lines.push(`   Assigné(s) : ${task.assigneeNames}`);
  lines.push(`   Statut : ${task.statusLabel}`);
  if (task.priorityLabel) lines.push(`   Priorité : ${task.priorityLabel}`);
  if (task.deadline) lines.push(`   Échéance : ${formatDateTime(task.deadline)}`);
  lines.push(`   Voir : ${task.href}`);
  return lines.join('\n');
}

function renderShooting(
  shoot: AiScopedCalendarPayload['shootings'][number],
  index: number,
): string {
  const lines = [
    `${index}. ${shoot.title} — ${shoot.clientName}`,
    `   Heure : ${formatDateTime(shoot.at)}`,
  ];
  if (shoot.teamNames) lines.push(`   Équipe : ${shoot.teamNames}`);
  if (shoot.shootLabel) lines.push(`   Note : ${shoot.shootLabel}`);
  lines.push(`   Statut : ${shoot.status}`);
  lines.push(`   Voir la vidéo : ${shoot.href}`);
  return lines.join('\n');
}

function renderDelivery(
  delivery: AiScopedCalendarPayload['deliveries'][number],
  index: number,
): string {
  return [
    `${index}. ${delivery.title} — ${delivery.clientName}`,
    `   Heure : ${formatDateTime(delivery.at)}`,
    `   Statut : ${delivery.status}`,
    `   Voir la vidéo : ${delivery.href}`,
  ].join('\n');
}

export function buildCalendarReply(payload: AiScopedCalendarPayload): string {
  const empty =
    payload.tasks.length === 0 &&
    payload.shootings.length === 0 &&
    payload.deliveries.length === 0;

  if (empty) {
    return payload.scopeMode === 'global'
      ? SUPAI_EMPTY_CALENDAR_GLOBAL
      : SUPAI_EMPTY_CALENDAR_PERSONAL;
  }

  const sections: string[] = [formatPeriodHeader(payload), ''];
  let index = 1;

  if (payload.tasks.length) {
    sections.push('1. Tâches', '');
    for (const task of payload.tasks) {
      sections.push(renderTask(task, index++));
      sections.push('');
    }
  }

  if (payload.shootings.length) {
    sections.push('2. Tournages', '');
    for (const shoot of payload.shootings) {
      sections.push(renderShooting(shoot, index++));
      sections.push('');
    }
  }

  if (payload.deliveries.length) {
    sections.push('3. Livraisons client', '');
    for (const delivery of payload.deliveries) {
      sections.push(renderDelivery(delivery, index++));
      sections.push('');
    }
  }

  if (payload.watchItems.length) {
    sections.push('4. Points à surveiller', '');
    for (const item of payload.watchItems) {
      sections.push(`- ${item.label} — ${item.detail}`);
      sections.push(`  Voir : ${item.href}`);
      sections.push('');
    }
  }

  return sections.join('\n').trim();
}
