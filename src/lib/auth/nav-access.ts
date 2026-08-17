/**
 * Application serveur de la politique de navigation (redirections).
 */

import { redirect } from 'next/navigation';
import { requireAuth, type AuthContext } from '@/lib/auth/permissions';
import { canAccessPath } from '@/lib/auth/nav-policy';

export { canAccessPath, getNavGroupsForRole, isStaff, navItemVisible } from '@/lib/auth/nav-policy';

const RBAC_EXEMPT_PATH_PREFIXES = ['/access-denied', '/change-password'] as const;

export function shouldEnforceRouteAccess(pathname: string): boolean {
  const path = (pathname.split('?')[0] ?? pathname).trim();
  if (!path) return false;
  return !RBAC_EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** RBAC guard using the request pathname (set by middleware as x-pathname). */
export async function enforceRouteAccessForPathname(
  pathname: string,
  existing?: AuthContext,
): Promise<void> {
  if (!shouldEnforceRouteAccess(pathname)) return;

  const ctx = existing ?? (await requireAuth());
  if (!ctx.employee || !ctx.role) {
    redirect('/access-denied');
  }
  if (!canAccessPath(ctx.role, pathname)) {
    redirect('/access-denied');
  }
}

/** Appeler depuis un layout de segment : redirige vers /access-denied si interdit. */
export async function enforceRouteAccess(segmentPath: string, existing?: AuthContext): Promise<void> {
  const ctx = existing ?? (await requireAuth());
  if (!ctx.employee || !ctx.role) {
    redirect('/access-denied');
  }
  if (!canAccessPath(ctx.role, segmentPath)) {
    redirect('/access-denied');
  }
}
