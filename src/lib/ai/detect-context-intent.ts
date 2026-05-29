import 'server-only';

import type { AuthContext } from '@/lib/auth/permissions';
import { isFinanceRequest } from '@/lib/ai/guardrails';
import { getSupaiPermissions } from '@/lib/ai/supai-permissions';
import type { AiContextRequest } from '@/lib/ai/context-schema';

export type DetectedContextIntent =
  | { action: 'fetch'; request: AiContextRequest }
  | { action: 'finance_denied' }
  | { action: 'none' };

const PRIORITIES_PATTERN =
  /\b(priorit|aujourd'hui|aujourdhui|ma journée|ma journee|mon jour|synthèse du jour|resume.*jour|summarize.*day)/i;

const OVERDUE_TASKS_PATTERN =
  /\b(tâche|tache|task).*(retard|en retard)|\b(retard|en retard).*(tâche|tache|task)/i;

const SEARCH_TASKS_PATTERN =
  /\b(cherche|chercher|trouve|trouver|liste|montre|show|search).*(tâche|tache|task)/i;

const SEARCH_CLIENTS_PATTERN =
  /\b(cherche|chercher|trouve|trouver|liste|montre|search).*(client)/i;

const SEARCH_VIDEOS_PATTERN =
  /\b(cherche|chercher|trouve|trouver|liste|montre|search).*(vidéo|video|tournage)/i;

const CLIENT_SUMMARY_PATTERN =
  /\b(résume|resumer|resume|synthèse|synthese|fiche|summary).*(client)/i;

const MY_TASKS_PATTERN =
  /\b(mes t[âa]ches|t[âa]ches assign[ée]es|mes taches assignees)\b/i;

const MY_VIDEOS_PATTERN =
  /\b(mes vid[ée]os|mes tournages|vid[ée]os assign[ée]es|tournages assign[ée]s)\b/i;

const SHOOTING_TODAY_PATTERN = /\b(tournage).*(aujourd'hui|aujourdhui|today)/i;

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

  if (PRIORITIES_PATTERN.test(text) || text === 'Résume mes priorités opérationnelles du jour (sans inventer de données live).') {
    return { action: 'fetch', request: { type: 'getTodayPriorities' } };
  }

  if (OVERDUE_TASKS_PATTERN.test(text) || text.includes('Tâches en retard')) {
    if (!perms.canUseSupAIReadTasks) return { action: 'none' };
    return {
      action: 'fetch',
      request: { type: 'searchTasks', query: extractQuery(text), overdueOnly: true },
    };
  }

  if (SHOOTING_TODAY_PATTERN.test(text)) {
    return { action: 'fetch', request: { type: 'getTodayPriorities' } };
  }

  if (MY_TASKS_PATTERN.test(text)) {
    if (!perms.canUseSupAIReadTasks) return { action: 'none' };
    return {
      action: 'fetch',
      request: { type: 'searchTasks', query: '', overdueOnly: false },
    };
  }

  if (MY_VIDEOS_PATTERN.test(text)) {
    if (!perms.canUseSupAIReadVideos) return { action: 'none' };
    return {
      action: 'fetch',
      request: { type: 'searchVideos', query: '' },
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

export function formatContextBlockForPrompt(result: import('@/lib/ai/context-schema').AiContextToolResult): string {
  if (!result.ok) {
    return result.denied ? `Accès refusé : ${result.reason}` : '';
  }
  if (result.empty) {
    return `Outil ${result.tool} : aucun résultat dans votre périmètre.`;
  }
  const header = `Outil ${result.tool}${result.truncated ? ' (résultats tronqués — principaux éléments)' : ''} :`;
  return `${header}\n${JSON.stringify(result.payload, null, 0)}`;
}
