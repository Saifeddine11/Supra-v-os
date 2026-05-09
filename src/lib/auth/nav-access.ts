/**
 * Application serveur de la politique de navigation (redirections).
 */

import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/permissions';
import { canAccessPath } from '@/lib/auth/nav-policy';

export { canAccessPath, getNavGroupsForRole, isStaff, navItemVisible } from '@/lib/auth/nav-policy';

/** Appeler depuis un layout de segment : redirige vers /access-denied si interdit. */
export async function enforceRouteAccess(segmentPath: string): Promise<void> {
  const ctx = await requireAuth();
  if (!ctx.employee || !ctx.role) {
    redirect('/access-denied');
  }
  if (!canAccessPath(ctx.role, segmentPath)) {
    redirect('/access-denied');
  }
}
