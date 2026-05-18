/**
 * Politique de navigation et de chemins par rôle (pur — importable côté client).
 * Aligné sur capabilities.ts ; ne pas dupliquer la logique métier ailleurs.
 * Uniquement `role` (RBAC) — pas `operational_skills`.
 */

import type { UserRole } from '@/types/database';
import type { NavGroup } from '@/config/navigation';
import { APP_NAV_GROUPS } from '@/config/navigation';
import {
  canManageClientPortal,
  canManagePayments,
  canViewInvoices,
  canViewOperationalReports,
} from '@/lib/auth/capabilities';

/** Rôles salariés (hors portail client). */
const STAFF: UserRole[] = [
  'admin',
  'project_manager',
  'commercial',
  'finance',
  'editor',
  'cameraman',
  'developer',
  'designer',
  'seo',
  'community_manager',
];

export function isStaff(role: UserRole | null): role is UserRole {
  return role != null && STAFF.includes(role);
}

/** Designer suit le même périmètre que développeur pour la navigation. */
function navKey(role: UserRole): UserRole {
  return role === 'designer' ? 'developer' : role;
}

/** Filtre un item de navigation selon le rôle. */
export function navItemVisible(href: string, role: UserRole): boolean {
  const r = navKey(role);

  switch (href) {
    case '/dashboard':
      return true;
    case '/clients':
      return r === 'admin' || r === 'project_manager' || r === 'commercial';
    case '/videos':
      return (
        r === 'admin' ||
        r === 'project_manager' ||
        r === 'editor' ||
        r === 'cameraman' ||
        r === 'community_manager'
      );
    case '/editorial':
      return r === 'admin' || r === 'project_manager' || r === 'community_manager';
    case '/tasks':
    case '/tasks/calendar':
      return (
        r === 'admin' ||
        r === 'project_manager' ||
        r === 'editor' ||
        r === 'cameraman' ||
        r === 'developer' ||
        r === 'seo' ||
        r === 'community_manager'
      );
    case '/projects':
      return (
        r === 'admin' ||
        r === 'project_manager' ||
        r === 'commercial' ||
        r === 'developer' ||
        r === 'seo'
      );
    case '/internal':
      return r === 'admin' || r === 'project_manager';
    case '/team':
      return r === 'admin';
    case '/invoices':
      return canViewInvoices(role);
    case '/quotes':
      return canViewInvoices(role);
    case '/payments':
      return canManagePayments(role);
    case '/reports':
      return canViewOperationalReports(role);
    case '/documents':
      return (
        r === 'admin' ||
        r === 'project_manager' ||
        r === 'commercial' ||
        r === 'editor' ||
        r === 'cameraman' ||
        r === 'developer' ||
        r === 'seo' ||
        r === 'community_manager'
      );
    case '/portal-admin':
      return canManageClientPortal(role);
    case '/notifications':
    case '/settings':
      return true;
    default:
      return false;
  }
}

export function getNavGroupsForRole(role: UserRole | null): NavGroup[] {
  if (!isStaff(role)) {
    return [
      {
        label: 'Vue d’ensemble',
        items: [{ href: '/dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard' }],
      },
    ];
  }

  const out: NavGroup[] = [];
  for (const group of APP_NAV_GROUPS) {
    const items = group.items.filter((item) => navItemVisible(item.href, role));
    if (items.length) out.push({ ...group, items });
  }
  return out;
}

/**
 * Vérifie l’accès à une route normalisée (ex. /clients, /tasks/calendar).
 */
export function canAccessPath(role: UserRole | null, pathname: string): boolean {
  if (!isStaff(role)) return false;
  const p = pathname.split('?')[0] ?? pathname;
  if (p.startsWith('/access-denied')) return true;

  if (p === '/dashboard' || p === '/notifications' || p === '/settings') return true;

  if (p.startsWith('/tasks/calendar')) return navItemVisible('/tasks/calendar', role);
  if (p.startsWith('/tasks')) return navItemVisible('/tasks', role);
  if (p.startsWith('/clients')) return navItemVisible('/clients', role);
  if (p.startsWith('/videos')) return navItemVisible('/videos', role);
  if (p.startsWith('/editorial')) return navItemVisible('/editorial', role);
  if (p.startsWith('/projects')) return navItemVisible('/projects', role);
  if (p.startsWith('/internal')) return navItemVisible('/internal', role);
  if (p.startsWith('/team')) return navItemVisible('/team', role);
  if (p.startsWith('/invoices')) return navItemVisible('/invoices', role);
  if (p.startsWith('/quotes')) return navItemVisible('/quotes', role);
  if (p.startsWith('/payments')) return navItemVisible('/payments', role);
  if (p.startsWith('/reports')) return navItemVisible('/reports', role);
  if (p.startsWith('/documents')) return navItemVisible('/documents', role);
  if (p.startsWith('/portal-admin')) return navItemVisible('/portal-admin', role);

  return false;
}
