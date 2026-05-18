/**
 * Capacités RBAC : basées uniquement sur le rôle permissionnel (`employees.role`).
 * Ne pas utiliser `operational_skills` ici — les compétences servent aux assignations / affichage terrain.
 */
import type { UserRole } from '@/types/database';

/** Lecture factures / paiements liés — hors chef de projet (pilotage prod sans finance). */
export function canViewInvoices(role: UserRole | null): boolean {
  return role === 'admin' || role === 'commercial' || role === 'finance';
}

/**
 * Forfait client, devise contrat, champs liés au CA client.
 * Réservé admin + commercial + finance — pas le chef de projet.
 */
export function canViewClientContractFinancials(role: UserRole | null): boolean {
  return role === 'admin' || role === 'commercial' || role === 'finance';
}

/**
 * KPI finance agence (CA prévu, encaissements, objectifs, paiements globaux, agrégats factures).
 * Réservé admin + finance — pas le chef de projet (pilotage prod / planning sans chiffres globaux).
 */
export function canViewGlobalFinanceStats(role: UserRole | null): boolean {
  return role === 'admin' || role === 'finance';
}

export function canModifyInvoices(role: UserRole | null): boolean {
  return role === 'admin' || role === 'commercial' || role === 'finance';
}

export function canModifyClients(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager' || role === 'commercial';
}

export function canDeleteClient(role: UserRole | null): boolean {
  return role === 'admin';
}

export function canDeleteTask(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager';
}

export function canDeleteVideo(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager';
}

export function canManageAllTasks(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager';
}

export function canManageClientPortal(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager';
}

export function canModifyQuotes(role: UserRole | null): boolean {
  return role === 'admin' || role === 'commercial' || role === 'finance';
}

export function canManageProjects(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager' || role === 'commercial';
}

export function canManagePayments(role: UserRole | null): boolean {
  return role === 'admin' || role === 'commercial' || role === 'finance';
}

export function canManageEmployees(role: UserRole | null): boolean {
  return role === 'admin';
}

/** Blocs intégrations / Supabase / cron / variables d’environnement sur /settings — admin uniquement. */
export function canViewSettingsTechnicalSection(role: UserRole | null): boolean {
  return role === 'admin';
}

/** Formulaire `agency_settings`, portail, facturation globale affichés sur /settings — admin uniquement. */
export function canManageAgencySettingsInUi(role: UserRole | null): boolean {
  return role === 'admin';
}
