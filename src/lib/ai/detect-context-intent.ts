import 'server-only';

import type { AuthContext } from '@/lib/auth/permissions';
import { isFinanceRequest } from '@/lib/ai/guardrails';
import { getSupaiPermissions } from '@/lib/ai/supai-permissions';
import { hasFullOrgDataAccess } from '@/lib/auth/data-scope';
import type { AiContextRequest } from '@/lib/ai/context-schema';
import { detectCalendarIntent } from '@/lib/ai/calendar-intent';
import { addDays, endOfDay, startOfDay } from 'date-fns';

export type DetectedContextIntent =
  | { action: 'fetch'; request: AiContextRequest }
  | { action: 'finance_denied' }
  | { action: 'clarify'; message: string }
  | { action: 'none' };

const PRIORITIES_TEMPLATE_PREFIX = `Donne-moi mes priorités opérationnelles aujourd'hui`;

const TEAM_PRIORITIES_PATTERN =
  /\b(priorit[ée]s\s+(?:de\s+)?(?:l[''])?équipe|priorit[ée]s\s+équipe|priorit[ée]s\s+agence|priorit[ée]s\s+op[ée]rationnelles\s+(?:de\s+)?(?:l[''])?équipe)\b/i;

const PERSONAL_PRIORITIES_PATTERN =
  /\b(mes priorit[ée]s|mon planning|ma journ[ée]e|ma charge(?: de travail)?|mon workload|qu['']est-ce que je dois faire(?: aujourd['']hui)?|je dois faire quoi(?: aujourd['']hui)?|j['']ai quoi(?:\s+comme\s+(?:t[âa]ches?|travail|urgences?))?|c['']est quoi mes?\s+urgences?|qu[']ai-?je\s+[àa]\s+traiter)\b/i;

const MY_TASKS_PATTERN =
  /\b(mes t[âa]ches|t[âa]ches assign[ée]es|mes taches assignees|j['']ai quoi comme t[âa]ches?|quelles?\s+sont\s+mes\s+t[âa]ches?|mes t[âa]ches aujourd['']hui|qu[']ai-?je comme t[âa]ches?|mon travail)\b/i;

const MY_OVERDUE_TASKS_PATTERN =
  /\bmes t[âa]ches en retard\b/i;

const MY_VIDEOS_PATTERN =
  /\b(mes vid[ée]os|vid[ée]os assign[ée]es|mes vid[ée]os en montage|mes montages|mes livraisons(?: client)?)\b/i;

const MY_SHOOTINGS_PATTERN =
  /\b(mes tournages|tournages assign[ée]s|mes tournages assign[ée]s|j['']ai quoi comme tournages?)\b/i;

const COMMERCIAL_CLIENTS_PATTERN =
  /\b(mes clients(?:\s+[àa]\s+relancer)?|clients?\s+[àa]\s+relancer|relances?\s+clients?)\b/i;

const OVERDUE_TASKS_GLOBAL_PATTERN =
  /\b(tâche|tache|task).*(retard|en retard)|\b(retard|en retard).*(tâche|tache|task)/i;

const SEARCH_TASKS_PATTERN =
  /\b(cherche|chercher|trouve|trouver|liste|montre|show|search).*(tâche|tache|task)/i;

const SEARCH_CLIENTS_PATTERN =
  /\b(cherche|chercher|trouve|trouver|liste|montre|search).*(client)/i;

const SEARCH_VIDEOS_PATTERN =
  /\b(cherche|chercher|trouve|trouver|liste|montre|search).*(vidéo|video|tournage)/i;

const CLIENT_SUMMARY_PATTERN =
  /\b(résume|resumer|resume|synthèse|synthese|fiche|summary).*(client)/i;

const SHOOTING_TODAY_PATTERN = /\b(tournage).*(aujourd'hui|aujourdhui|today)/i;

const UPCOMING_SHOOTINGS_PATTERN =
  /\b(quels?\s+sont\s+les\s+tournages?|tournages?\s+(?:à venir|a venir|prochains?|futurs?|à\s+planifier))\b/i;

const UPCOMING_DELIVERIES_PATTERN =
  /\b(quelles?\s+sont\s+les\s+livraisons?(?:\s+client)?|livraisons?(?:\s+client)?\s+(?:à venir|a venir|prochaines?|cette semaine|ce mois))\b/i;

function upcomingCalendarRequest(
  periodLabel: string,
  eventFocus: 'shootings' | 'deliveries',
  ctx: AuthContext,
  personalWording: boolean,
): DetectedContextIntent {
  const start = startOfDay(new Date());
  const end = endOfDay(addDays(start, 90));
  const scopeMode =
    hasFullOrgDataAccess(ctx) && !personalWording ? ('global' as const) : ('personal' as const);

  return {
    action: 'fetch',
    request: {
      type: 'getScopedCalendarWork',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      periodLabel,
      scopeMode,
      eventFocus,
    },
  };
}

function extractQuery(message: string, after?: RegExp): string {
  const trimmed = message.trim();
  if (after) {
    const m = after.exec(trimmed);
    if (m?.[1]) return m[1].trim().slice(0, 200);
  }
  const quoted = /["«]([^"»]{2,120})["»]/.exec(trimmed);
  if (quoted?.[1]) return quoted[1].trim();
  const clientNamed = /client\s+(.{2,80})/i.exec(trimmed);
  if (clientNamed?.[1]) return clientNamed[1].trim();
  return trimmed.replace(/^(?:cherche|chercher|trouve|trouver|montre|liste|résume|resumer)\s+/i, '').slice(0, 200);
}

function personalWorkRequest(focus: AiContextRequest['focus']): DetectedContextIntent {
  return { action: 'fetch', request: { type: 'getMyOperationalWork', focus } };
}

export function detectPersonalWorkIntent(
  message: string,
  ctx: AuthContext,
): DetectedContextIntent | null {
  const text = message.trim();
  if (!text) return null;

  const perms = getSupaiPermissions(ctx);
  if (!perms.canUseSupAIPersonalWork) return null;

  if (MY_OVERDUE_TASKS_PATTERN.test(text)) {
    return personalWorkRequest('overdue');
  }

  if (MY_TASKS_PATTERN.test(text)) {
    return personalWorkRequest('tasks');
  }

  if (MY_SHOOTINGS_PATTERN.test(text)) {
    if (!perms.canUseSupAIReadVideos) return personalWorkRequest('tasks');
    return personalWorkRequest('shootings');
  }

  if (MY_VIDEOS_PATTERN.test(text)) {
    if (!perms.canUseSupAIReadVideos) return personalWorkRequest('tasks');
    return personalWorkRequest('videos');
  }

  if (PERSONAL_PRIORITIES_PATTERN.test(text) || text.startsWith(PRIORITIES_TEMPLATE_PREFIX)) {
    return personalWorkRequest('priorities');
  }

  if (
    /\b(j['']ai quoi|je dois faire quoi|mon travail|mon planning)\b/i.test(text) &&
    !TEAM_PRIORITIES_PATTERN.test(text)
  ) {
    return personalWorkRequest('all');
  }

  return null;
}

export function detectContextIntentFromMessage(
  message: string,
  ctx: AuthContext,
): DetectedContextIntent {
  const text = message.trim();
  if (!text) return { action: 'none' };

  const perms = getSupaiPermissions(ctx);

  if (isFinanceRequest(text) && !perms.canUseSupAIFinanceContext) {
    return { action: 'finance_denied' };
  }

  const calendar = detectCalendarIntent(text, ctx);
  if (calendar.ok) {
    return {
      action: 'fetch',
      request: {
        type: 'getScopedCalendarWork',
        startDate: calendar.intent.period.start.toISOString(),
        endDate: calendar.intent.period.end.toISOString(),
        periodLabel: calendar.intent.period.label,
        scopeMode: calendar.intent.scopeMode,
        eventFocus: calendar.intent.eventFocus,
      },
    };
  }
  if (calendar.clarify) {
    return { action: 'clarify', message: calendar.clarify };
  }

  if (UPCOMING_SHOOTINGS_PATTERN.test(text)) {
    return upcomingCalendarRequest(
      'tournages à venir',
      'shootings',
      ctx,
      /\b(mes|mon|j['']ai)\b/i.test(text),
    );
  }

  if (UPCOMING_DELIVERIES_PATTERN.test(text) && !/\b(on a quoi|j['']ai quoi)\b/i.test(text)) {
    return upcomingCalendarRequest(
      'livraisons à venir',
      'deliveries',
      ctx,
      /\b(mes|mon|j['']ai)\b/i.test(text),
    );
  }

  const personal = detectPersonalWorkIntent(message, ctx);
  if (personal) return personal;

  if (COMMERCIAL_CLIENTS_PATTERN.test(text)) {
    if (!perms.canUseSupAIReadClients) return { action: 'none' };
    return {
      action: 'fetch',
      request: { type: 'searchClients', query: extractQuery(text) },
    };
  }

  if (hasFullOrgDataAccess(ctx) && (TEAM_PRIORITIES_PATTERN.test(text) || SHOOTING_TODAY_PATTERN.test(text))) {
    return { action: 'fetch', request: { type: 'getTodayPriorities' } };
  }

  if (OVERDUE_TASKS_GLOBAL_PATTERN.test(text) || text.includes('Tâches en retard')) {
    if (!perms.canUseSupAIReadTasks) return { action: 'none' };
    return {
      action: 'fetch',
      request: { type: 'searchTasks', query: extractQuery(text), overdueOnly: true },
    };
  }

  if (CLIENT_SUMMARY_PATTERN.test(text)) {
    if (!perms.canUseSupAIReadClients) return { action: 'none' };
    return {
      action: 'fetch',
      request: { type: 'getClientSummary', query: extractQuery(text, /client\s+(.+)/i) },
    };
  }

  if (SEARCH_CLIENTS_PATTERN.test(text) || text.startsWith('Cherche le client ')) {
    if (!perms.canUseSupAIReadClients) return { action: 'none' };
    return {
      action: 'fetch',
      request: { type: 'searchClients', query: extractQuery(text.replace(/^Cherche le client\s+/i, '')) },
    };
  }

  if (SEARCH_VIDEOS_PATTERN.test(text) || text.startsWith('Cherche la vidéo ')) {
    if (!perms.canUseSupAIReadVideos) return { action: 'none' };
    return {
      action: 'fetch',
      request: { type: 'searchVideos', query: extractQuery(text.replace(/^Cherche la vidéo\s+/i, '')) },
    };
  }

  if (SEARCH_TASKS_PATTERN.test(text)) {
    if (!perms.canUseSupAIReadTasks) return { action: 'none' };
    return {
      action: 'fetch',
      request: { type: 'searchTasks', query: extractQuery(text) },
    };
  }

  return { action: 'none' };
}

export function isMyAssignedWorkContextRequest(request: AiContextRequest): boolean {
  return request.type === 'getMyOperationalWork';
}

export function isScopedCalendarContextRequest(request: AiContextRequest): boolean {
  return request.type === 'getScopedCalendarWork';
}

export function formatContextBlockForPrompt(result: import('@/lib/ai/context-schema').AiContextToolResult): string {
  if (!result.ok) {
    return result.denied ? `Accès refusé : ${result.reason}` : '';
  }
  if (result.empty) {
    if (result.tool === 'getMyOperationalWork') {
      return 'Outil getMyOperationalWork : aucune tâche ni vidéo assignée à cet utilisateur. Répondez exactement que rien n’a été trouvé — n’inventez rien.';
    }
    if (result.tool === 'getScopedCalendarWork') {
      return 'Outil getScopedCalendarWork : aucun événement opérationnel sur la période. Répondez exactement qu’aucun élément n’a été trouvé — n’inventez rien.';
    }
    return `Outil ${result.tool} : aucun résultat dans votre périmètre.`;
  }
  const header = `Outil ${result.tool}${result.truncated ? ' (résultats tronqués — principaux éléments)' : ''} :`;
  const instruction =
    result.tool === 'getMyOperationalWork'
      ? 'Répondez UNIQUEMENT à partir de ces données personnelles assignées. Ne mentionnez jamais toute l’équipe ni des éléments non listés.'
      : result.tool === 'getScopedCalendarWork'
        ? 'Répondez UNIQUEMENT à partir de ces événements calendrier. Ne mentionnez jamais d’éléments non listés.'
        : '';
  return `${header}\n${instruction ? `${instruction}\n` : ''}${JSON.stringify(result.payload, null, 0)}`;
}
