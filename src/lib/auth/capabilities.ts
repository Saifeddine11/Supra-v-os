/**
 * Capacités RBAC : basées uniquement sur le rôle permissionnel (`employees.role`).
 * Ne pas utiliser `operational_skills` ici — les compétences servent aux assignations / affichage terrain.
 *
 * Chef de projet (`project_manager`) : pilotage opérationnel complet, sans finance globale
 * (CA, encaissements, objectifs CA, paiements, factures/devis, rentabilité).
 */
import type { UserRole } from '@/types/database';

const PM: UserRole = 'project_manager';

// ─── Finance globale (interdit au chef de projet) ───────────────────────────

/** Lecture factures / paiements — hors chef de projet. */
export function canViewInvoices(role: UserRole | null): boolean {
  return role === 'admin' || role === 'commercial' || role === 'finance';
}

/** Page / API paiements (lecture et écriture). */
export function canViewPayments(role: UserRole | null): boolean {
  return canManagePayments(role);
}

export function canManagePayments(role: UserRole | null): boolean {
  return role === 'admin' || role === 'commercial' || role === 'finance';
}

/**
 * Forfait client, devise contrat, champs liés au CA client.
 * Réservé admin + commercial + finance.
 */
export function canViewClientContractFinancials(role: UserRole | null): boolean {
  return role === 'admin' || role === 'commercial' || role === 'finance';
}

/**
 * KPI finance agence (CA prévu, encaissements, objectifs CA, paiements globaux, agrégats factures).
 */
export function canViewGlobalFinanceStats(role: UserRole | null): boolean {
  return role === 'admin' || role === 'finance';
}

/** CA / revenus (global ou portefeuille commercial). */
export function canViewRevenue(role: UserRole | null): boolean {
  return canViewGlobalFinanceStats(role) || role === 'commercial';
}

/** Rentabilité / marges agence — réservé admin + finance. */
export function canViewProfitability(role: UserRole | null): boolean {
  return canViewGlobalFinanceStats(role);
}

/** Objectifs mensuels agence (table `agency_monthly_goals`, dont objectif CA). */
export function canViewAgencyGoals(role: UserRole | null): boolean {
  return role === 'admin' || role === 'finance' || role === 'commercial';
}

/** Compteurs pipeline devis (montants / statuts devis) — pas le chef de projet. */
export function canViewQuotePipelineStats(role: UserRole | null): boolean {
  return canModifyQuotes(role) || role === 'finance';
}

export function canModifyInvoices(role: UserRole | null): boolean {
  return role === 'admin' || role === 'commercial' || role === 'finance';
}

export function canModifyQuotes(role: UserRole | null): boolean {
  return role === 'admin' || role === 'commercial' || role === 'finance';
}

// ─── Opérationnel (chef de projet inclus) ──────────────────────────────────

export function canModifyClients(role: UserRole | null): boolean {
  return role === 'admin' || role === PM || role === 'commercial';
}

export function canManageClients(role: UserRole | null): boolean {
  return canModifyClients(role);
}

export function canDeleteClient(role: UserRole | null): boolean {
  return role === 'admin';
}

export function canManageAllTasks(role: UserRole | null): boolean {
  return role === 'admin' || role === PM;
}

/** Alias explicite — création / édition / statuts / kanban tâches. */
export const canManageTasks = canManageAllTasks;

/** Création de tâche (hors finance / commercial). */
export function canCreateTasks(role: UserRole | null): boolean {
  if (!role) return false;
  return role !== 'finance' && role !== 'commercial';
}

/** Édition d’une tâche (même périmètre que création côté app). */
export const canUpdateTasks = canCreateTasks;

export function canDeleteTask(role: UserRole | null): boolean {
  return role === 'admin' || role === PM;
}

export const canDeleteTasks = canDeleteTask;

/** Archivage (= changement de statut vers archived). */
export const canArchiveTasks = canCreateTasks;

/** Assignation multi-membres (admin / chef de projet). */
export const canAssignTasks = canManageAllTasks;

/** Kanban, statuts rapides, drag & drop. */
export const canChangeTaskStatus = canCreateTasks;

export function canManageVideos(role: UserRole | null): boolean {
  return (
    role === 'admin' ||
    role === PM ||
    role === 'editor' ||
    role === 'cameraman' ||
    role === 'community_manager' ||
    role === 'commercial'
  );
}

export function canDeleteVideo(role: UserRole | null): boolean {
  return role === 'admin' || role === PM;
}

export function canManageClientPortal(role: UserRole | null): boolean {
  return role === 'admin' || role === PM;
}

export function canManageProjects(role: UserRole | null): boolean {
  return role === 'admin' || role === PM || role === 'commercial';
}

export function canDeleteProject(role: UserRole | null): boolean {
  return role === 'admin' || role === PM;
}

export function canDeleteInternalProject(role: UserRole | null): boolean {
  return role === 'admin' || role === PM;
}

/** Rapports client (production, SEO, etc.) — pas les rapports finance sensibles. */
export function canViewOperationalReports(role: UserRole | null): boolean {
  return (
    role === 'admin' ||
    role === PM ||
    role === 'commercial' ||
    role === 'finance' ||
    role === 'seo' ||
    role === 'community_manager'
  );
}

export function canManageEmployees(role: UserRole | null): boolean {
  return role === 'admin';
}

/** Blocs intégrations / Supabase / cron / variables d’environnement sur /settings — admin uniquement. */
export function canViewSettingsTechnicalSection(role: UserRole | null): boolean {
  return role === 'admin';
}

/** Formulaire `agency_settings`, portail, objectifs CA sur /settings — admin uniquement. */
export function canManageAgencySettingsInUi(role: UserRole | null): boolean {
  return role === 'admin';
}
