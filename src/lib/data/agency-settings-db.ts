import { createClient } from '@/lib/supabase/server';
import type { AgencySettingsRow } from '@/types/database';

export async function getAgencySettingsRow(): Promise<AgencySettingsRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('agency_settings').select('*').eq('id', 1).maybeSingle();
  if (error) {
    console.error('agency_settings:', error.message);
    return null;
  }
  return data as AgencySettingsRow | null;
}
