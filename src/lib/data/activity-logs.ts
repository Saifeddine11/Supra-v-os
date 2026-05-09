import { createClient } from '@/lib/supabase/server';
import type { ActivityLog } from '@/types/database';

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
