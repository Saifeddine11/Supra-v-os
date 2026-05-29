import 'server-only';

import type { UserRole } from '@/types/database';
import { canViewGlobalFinanceStats } from '@/lib/auth/capabilities';
import { detectUserChatIntent } from '@/lib/ai/detect-user-intent';
import type { AiStaffContext } from '@/lib/ai/system-prompt';
import {
  SUPAI_REFUSAL_AUTO_SEND,
  SUPAI_REFUSAL_DESTRUCTIVE,
  SUPAI_REFUSAL_FINANCE,
  SUPAI_REFUSAL_FORBIDDEN_MVP,
  SUPAI_REFUSAL_PERMISSION,
  SUPAI_REFUSAL_SECRETS,
} from '@/lib/ai/supai-copy';
import { evaluateGlobalTeamGuardrail } from '@/lib/ai/supai-permissions';

export type GuardrailRefusalType =
  | 'finance_unauthorized'
  | 'destructive_action'
  | 'forbidden_mvp_action'
  | 'auto_send'
  | 'secrets'
  | 'permission_denied';

export type GuardrailRefusal = {
  type: GuardrailRefusalType;
  reply: string;
};

const FINANCE_PATTERNS = [
  /\b(ca\b|chiffre d['']affaires|chiffre d affaires)\b/i,
  /\b(revenu|revenue|recette)\b/i,
  /\b(encaiss|encaissement|encaissé|encaissée)\b/i,
  /\b(paiement|paiements)\b/i,
  /\b(factur|facture|factures payées|factures impayées)\b/i,
  /\b(profit|rentabilit|marge|marges)\b/i,
  /\b(cashflow|cash flow|trésorerie)\b/i,
  /\b(objectif ca|objectif chiffre|objectifs ca)\b/i,
  /\b(kpi finance|stats finance|données financières)\b/i,
  /\b(combien on a (?:gagné|encaissé|facturé))\b/i,
  /\b(donne(?:r)?(?:-|\s)?moi le ca)\b/i,
];

const DELETE_PATTERNS = [
  /\b(supprime|supprimer|efface|effacer|delete|remove)\b/i,
  /\b(effacement|deletion)\b/i,
];

const ARCHIVE_PATTERNS = [/\b(archive|archiver|archivage)\b/i];

const ENTITY_PATTERNS = /\b(tâche|tache|task|vidéo|video|production|client|projet)\b/i;

const AUTO_SEND_PATTERNS = [
  /\b(envoie|envoyer|send|expédie|expédier)\b/i,
  /\b(envoi automatique|auto-?send)\b/i,
];

const MESSAGE_CHANNEL_PATTERNS = /\b(whatsapp|mail|e-mail|email|sms|message|relance)\b/i;

const PORTAL_PUBLISH_PATTERNS = [
  /\b(publie|publier|publish|mettre en ligne)\b/i,
  /\b(portail client|portail|portal)\b/i,
];

const MODIFY_FINANCE_PATTERNS = [
  /\b(modifie|modifier|change|changer|update|met à jour|mets à jour)\b/i,
  /\b(facture|factures|devis|paiement|invoice|quote)\b/i,
];

const SECRETS_PATTERNS = [
  /\b(service role|service_role|supabase_service)\b/i,
  /\b(supabase.*key|api key|apikey|openrouter.*key)\b/i,
  /\b(\.env|process\.env|environment variable|variables d['']environnement)\b/i,
  /\b(resend_api|secret key|clé secrète)\b/i,
];

const SQL_DESTRUCTIVE_PATTERNS = [
  /\bdrop\s+table\b/i,
  /\bdelete\s+from\b/i,
  /\btruncate\s+table\b/i,
  /\balter\s+table\b/i,
  /\bbypass\s+rls\b/i,
  /\bdisable\s+rls\b/i,
];

/** Finance-related question (CA, encaissements, marge, factures globales, etc.). */
export function isFinanceRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return FINANCE_PATTERNS.some((p) => p.test(text));
}

/** Delete/remove request targeting app entities via SupAI. */
export function isDestructiveRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (SQL_DESTRUCTIVE_PATTERNS.some((p) => p.test(text))) return true;
  const wantsDelete = DELETE_PATTERNS.some((p) => p.test(text));
  const wantsArchive = ARCHIVE_PATTERNS.some((p) => p.test(text));
  if (!wantsDelete && !wantsArchive) return false;
  return ENTITY_PATTERNS.test(text) || /\b(cette|celle|ce|cette)\b/i.test(text);
}

/** MVP-forbidden actions beyond delete/archive (auto-send, portal publish, finance edits). */
export function isForbiddenAiAction(message: string): boolean {
  const text = message.trim();
  if (!text) return false;

  if (AUTO_SEND_PATTERNS.some((p) => p.test(text)) && MESSAGE_CHANNEL_PATTERNS.test(text)) {
    if (!/\b(rédige|redige|écris|ecris|draft|brouillon|prépare|prepare)\b/i.test(text)) {
      return true;
    }
  }

  if (
    PORTAL_PUBLISH_PATTERNS.some((p) => p.test(text)) &&
    (/\b(portail|portal|client)\b/i.test(text) || /\b(vidéo|video)\b/i.test(text))
  ) {
    return true;
  }

  if (
    MODIFY_FINANCE_PATTERNS[0]!.test(text) &&
    MODIFY_FINANCE_PATTERNS[1]!.test(text)
  ) {
    return true;
  }

  return false;
}

export function isSecretsRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return SECRETS_PATTERNS.some((p) => p.test(text));
}

export function getRoleBasedRefusal(
  role: UserRole,
  requestType: GuardrailRefusalType,
): string {
  void role;
  switch (requestType) {
    case 'finance_unauthorized':
      return SUPAI_REFUSAL_FINANCE;
    case 'destructive_action':
      return SUPAI_REFUSAL_DESTRUCTIVE;
    case 'forbidden_mvp_action':
      return SUPAI_REFUSAL_FORBIDDEN_MVP;
    case 'auto_send':
      return SUPAI_REFUSAL_AUTO_SEND;
    case 'secrets':
      return SUPAI_REFUSAL_SECRETS;
    case 'permission_denied':
    default:
      return SUPAI_REFUSAL_PERMISSION;
  }
}

/**
 * Deterministic server-side guardrails — returns a refusal before calling the model.
 */
export function evaluateSupaiGuardrails(
  message: string,
  ctx: AiStaffContext,
): GuardrailRefusal | null {
  const text = message.trim();
  if (!text) return null;

  if (isSecretsRequest(text)) {
    return { type: 'secrets', reply: getRoleBasedRefusal(ctx.role, 'secrets') };
  }

  if (SQL_DESTRUCTIVE_PATTERNS.some((p) => p.test(text))) {
    return { type: 'destructive_action', reply: getRoleBasedRefusal(ctx.role, 'destructive_action') };
  }

  if (isFinanceRequest(text) && !ctx.supai.canUseSupAIFinanceContext) {
    return { type: 'finance_unauthorized', reply: getRoleBasedRefusal(ctx.role, 'finance_unauthorized') };
  }

  const globalTeamBlock = evaluateGlobalTeamGuardrail(text, ctx.supai);
  if (globalTeamBlock) {
    return { type: 'permission_denied', reply: globalTeamBlock };
  }

  if (isDestructiveRequest(text)) {
    return { type: 'destructive_action', reply: getRoleBasedRefusal(ctx.role, 'destructive_action') };
  }

  if (
    AUTO_SEND_PATTERNS.some((p) => p.test(text)) &&
    MESSAGE_CHANNEL_PATTERNS.test(text) &&
    !/\b(rédige|redige|écris|ecris|draft|brouillon|prépare|prepare)\b/i.test(text)
  ) {
    return { type: 'auto_send', reply: getRoleBasedRefusal(ctx.role, 'auto_send') };
  }

  if (isForbiddenAiAction(text)) {
    return { type: 'forbidden_mvp_action', reply: getRoleBasedRefusal(ctx.role, 'forbidden_mvp_action') };
  }

  const intent = detectUserChatIntent(text);
  if (intent.isCreateTask && !ctx.supai.canUseSupAICreateTaskDraft) {
    return { type: 'permission_denied', reply: getRoleBasedRefusal(ctx.role, 'permission_denied') };
  }
  if (intent.isCreateVideo && !ctx.supai.canUseSupAICreateVideoDraft) {
    return { type: 'permission_denied', reply: getRoleBasedRefusal(ctx.role, 'permission_denied') };
  }

  return null;
}

/** Whether role may view global finance through SupAI tools. */
export function roleMayViewFinance(role: UserRole | null): boolean {
  return canViewGlobalFinanceStats(role);
}
