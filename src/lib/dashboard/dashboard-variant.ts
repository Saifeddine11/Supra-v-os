import type { UserRole } from '@/types/database';

/**
 * Variante d’expérience dashboard (indépendante de `DashboardSummary.scope`
 * qui reste alignée sur les agrégats finance/commercial).
 */
export type DashboardVariant = 'admin' | 'manager' | 'commercial' | 'finance' | 'individual';

export function getDashboardVariant(role: UserRole | null): DashboardVariant {
  if (!role) return 'individual';
  if (role === 'admin') return 'admin';
  if (role === 'project_manager') return 'manager';
  if (role === 'commercial') return 'commercial';
  if (role === 'finance') return 'finance';
  return 'individual';
}

/** Rôles qui ne doivent jamais recevoir le flux brut `activity_logs` global. */
export function shouldLoadGlobalActivityFeed(variant: DashboardVariant): boolean {
  return variant === 'admin' || variant === 'manager';
}
