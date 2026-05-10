import { createClient } from '@/lib/supabase/server';
import type { ActivityLog } from '@/types/database';
import type { DashboardVariant } from '@/lib/dashboard/dashboard-variant';
import { isSensitiveActivityLog } from '@/lib/data/activity-log-display';

export async function listActivityForEntity(
  entityType: string,
  entityId: string,
  limit = 30
): Promise<ActivityLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLog[];
}

export async function listRecentActivity(limit = 12): Promise<ActivityLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
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

  if (variant === 'admin') {
    return listRecentActivity(limit);
  }

  const fetchCap = Math.min(Math.max(limit * 5, 20), 80);
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .neq('entity_type', 'employee')
    .order('created_at', { ascending: false })
    .limit(fetchCap);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ActivityLog[];
  return rows.filter((r) => !isSensitiveActivityLog(r)).slice(0, limit);
}
