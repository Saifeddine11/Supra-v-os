import type { ActivityLog } from '@/types/database';

const ACTION_LABELS_FR: Record<string, string> = {
  created: 'Création',
  updated: 'Mise à jour',
  archived: 'Archivage',
  deleted: 'Suppression',
  employee_created: 'Membre ajouté à l’équipe',
  employee_updated: 'Profil membre mis à jour',
  employee_role_changed: 'Rôle d’un membre modifié',
  employee_skills_changed: 'Compétences opérationnelles modifiées',
  employee_reactivated: 'Membre réactivé',
  employee_disabled: 'Membre désactivé',
  employee_archived: 'Membre archivé',
  employee_unarchived: 'Membre désarchivé',
  employee_deleted: 'Membre supprimé',
  employee_auth_account_created: 'Compte Auth créé pour un membre',
  employee_auth_linked: 'Compte Auth lié au profil',
  employee_auth_invite_sent: 'Invitation Auth envoyée',
  employee_auth_invite_failed: 'Échec invitation Auth',
  employee_auth_create_failed: 'Échec création compte Auth',
  employee_auth_password_reset_sent: 'E-mail de réinitialisation mot de passe envoyé',
  employee_auth_password_reset_failed: 'Échec envoi réinitialisation mot de passe',
};

const ENTITY_LABELS_FR: Record<string, string> = {
  task: 'Tâche',
  video: 'Vidéo',
  project: 'Projet',
  client: 'Client',
  document: 'Document',
  report: 'Rapport',
  quote: 'Devis',
  invoice: 'Facture',
  payment: 'Paiement',
  employee: 'Membre',
  client_portal: 'Portail client',
};

/** Libellé lisible pour l’action (admin / chef de projet). */
export function formatActivityActionLabel(action: string): string {
  return ACTION_LABELS_FR[action] ?? action.replace(/_/g, ' ');
}

export function formatActivityEntityLabel(entityType: string | null | undefined): string | null {
  if (!entityType) return null;
  return ENTITY_LABELS_FR[entityType] ?? entityType.replace(/_/g, ' ');
}

const SENSITIVE_ENTITY_PREFIXES = ['employee'];
const SENSITIVE_ENTITY_EXACT = new Set(['agency_settings']);

export function isSensitiveActivityLog(log: Pick<ActivityLog, 'entity_type' | 'action'>): boolean {
  const et = (log.entity_type ?? '').toLowerCase();
  const act = (log.action ?? '').toLowerCase();
  if (SENSITIVE_ENTITY_EXACT.has(et)) return true;
  if (SENSITIVE_ENTITY_PREFIXES.some((p) => et === p || et.startsWith(`${p}_`))) return true;
  if (act.startsWith('employee_')) return true;
  if (act.includes('password') && act.includes('reset')) return true;
  if (act.startsWith('auth_')) return true;
  if (et.startsWith('auth')) return true;
  if (act.includes('cron') || et.includes('cron')) return true;
  if (act.includes('system') || et.includes('system')) return true;
  return false;
}

/** Phrase courte pour l’aperçu dashboard (pas de clés brutes). */
export function formatActivityLogSummaryLine(log: ActivityLog): string {
  const who = log.actor_label?.trim() || 'Système';
  const actionFr = formatActivityActionLabel(log.action);
  const entityFr = formatActivityEntityLabel(log.entity_type);
  if (entityFr) {
    return `${who} · ${actionFr} · ${entityFr}`;
  }
  return `${who} · ${actionFr}`;
}
