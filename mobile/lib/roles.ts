/**
 * Role display + navigation visibility for mobile.
 * Mirrors the web app's rules (src/lib/auth/nav-policy.ts, src/types/domain.ts).
 * UI-only convenience — RLS on the server remains the source of truth.
 */
import type { UserRole } from '@/types/db';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  project_manager: 'Chef de projet',
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
    r === 'editor' ||
    r === 'cameraman' ||
    r === 'developer' ||
    r === 'seo' ||
    r === 'community_manager'
  );
}

export function isAdminOrPM(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager';
}
