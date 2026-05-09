/**
 * Capacités RBAC : basées uniquement sur le rôle permissionnel (`employees.role`).
 * Ne pas utiliser `operational_skills` ici — les compétences servent aux assignations / affichage terrain.
 */
import type { UserRole } from '@/types/database';

export function canViewInvoices(role: UserRole | null): boolean {
  return (
    role === 'admin' ||
    role === 'project_manager' ||
    role === 'commercial' ||
    role === 'finance'
  );
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
