import { createClient } from '@/lib/supabase/server';
import type { ActivityLog } from '@/types/database';
import type { DashboardVariant } from '@/lib/dashboard/dashboard-variant';
import { isSensitiveActivityLog } from '@/lib/data/activity-log-display';
import { parseUuidParam } from '@/lib/security/input-validation';

/** Types d’entités connus pour `activity_logs` (évite filtres arbitraires PostgREST). */
const ENTITY_TYPES_FOR_LIST = new Set([
  'client',
  'quote',
  'employee',
  'project',
  'task',
  'video',
  'invoice',
  'payment',
  'document',
  'report',
  'internal_project',
]);

function clampActivityLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 12;
  return Math.min(100, Math.max(1, Math.floor(limit)));
}

export async function listActivityForEntity(
  entityType: string,
  entityId: string,
  limit = 30
): Promise<ActivityLog[]> {
  if (!ENTITY_TYPES_FOR_LIST.has(entityType) || !parseUuidParam(entityId)) {
    return [];
  }
  const supabase = await createClient();
  const lim = clampActivityLimit(limit);
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(lim);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLog[];
}

export async function listRecentActivity(limit = 12): Promise<ActivityLog[]> {
  const supabase = await createClient();
  const lim = clampActivityLimit(limit);
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(lim);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLog[];
}

/**
 * Flux activité dashboard : admin = tout ; chef de projet = métier uniquement (pas RH/Auth employés).
 * Finance, commercial, rôles opérationnels : ne pas appeler — retourne [].
 */
export async function listDashboardActivityForVariant(
  variant: DashboardVariant,
  limit = 12
): Promise<ActivityLog[]> {
  if (variant !== 'admin' && variant !== 'manager') {
    return [];
  }

  const supabase = await createClient();
  const lim = clampActivityLimit(limit);

  if (variant === 'admin') {
    return listRecentActivity(lim);
  }

  const fetchCap = Math.min(Math.max(lim * 5, 20), 80);
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .neq('entity_type', 'employee')
    .order('created_at', { ascending: false })
    .limit(fetchCap);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ActivityLog[];
  return rows.filter((r) => !isSensitiveActivityLog(r)).slice(0, lim);
}
