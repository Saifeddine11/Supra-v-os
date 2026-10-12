/**
 * Role display + navigation visibility for mobile.
 * Mirrors the web app's rules (src/lib/auth/nav-policy.ts, src/types/domain.ts).
 * UI-only convenience — RLS on the server remains the source of truth.
 */
import type { UserRole } from '@/types/db';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  project_manager: 'Chef de projet',
  department_supervisor: 'Superviseur de pôle',
  editor: 'Monteur',
  cameraman: 'Cadreur',
  developer: 'Développeur',
  designer: 'Designer',
  seo: 'SEO',
  commercial: 'Commercial',
  community_manager: 'Community Manager',
  finance: 'Finance',
  client: 'Client',
};

/** Designer follows the developer navigation scope (same as web navKey). */
function navKey(role: UserRole): UserRole {
  return role === 'designer' ? 'developer' : role;
}

/** Mirrors web navItemVisible('/videos', role). */
export function hasVideoAccess(role: UserRole | null): boolean {
  if (!role) return false;
  const r = navKey(role);
  return (
    r === 'admin' ||
    r === 'project_manager' ||
    r === 'editor' ||
    r === 'cameraman' ||
    r === 'community_manager'
  );
}

/** Mirrors web navItemVisible('/tasks', role) + taskListingDenied (finance/commercial). */
export function hasTaskAccess(role: UserRole | null): boolean {
  if (!role) return false;
  const r = navKey(role);
  return (
    r === 'admin' ||
    r === 'project_manager' ||
    r === 'department_supervisor' ||
    r === 'editor' ||
    r === 'cameraman' ||
    r === 'developer' ||
    r === 'seo' ||
    r === 'community_manager'
  );
}

/**
 * Libellé d'un rôle. Repli sur la valeur brute si le rôle est inconnu du
 * mobile (dérive d'enum côté web) : mieux vaut afficher « department_supervisor »
 * qu'un champ vide — cela rend le diagnostic possible depuis l'écran Profil,
 * y compris en build TestFlight où les logs `__DEV__` n'existent pas.
 */
export function roleLabel(role: UserRole | null): string {
  if (!role) return '—';
  return ROLE_LABELS[role] ?? String(role);
}

/**
 * Création de tâche — miroir de `canCreateTasks` (src/lib/auth/capabilities.ts).
 *
 * Le web autorise tout le monde sauf finance / commercial ; la RLS
 * `tasks_insert_operational` autorise admin, chef de projet, superviseur de
 * pôle (sur son pôle) et les rôles opérationnels. Le mobile utilisait
 * `isAdminOrPM`, strictement plus restrictif que le web : le bouton
 * « Nouvelle tâche » disparaissait pour des rôles pourtant autorisés à créer.
 *
 * `client` est exclu explicitement : contrairement au web (portail séparé),
 * l'app mobile héberge les deux types de comptes.
 */
export function canCreateTasks(role: UserRole | null): boolean {
  if (!role) return false;
  return role !== 'finance' && role !== 'commercial' && role !== 'client';
}

/** Réservé aux actions admin/chef de projet (ex. suppression dure). */
export function isAdminOrPM(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager';
}

/** Approbation / validation. Le superviseur reste limité à son pôle par la base. */
export function canReviewTasks(
  role: UserRole | null,
  isDepartmentSupervisor = false,
): boolean {
  return role === 'admin' || role === 'project_manager' || role === 'department_supervisor' || isDepartmentSupervisor;
}
