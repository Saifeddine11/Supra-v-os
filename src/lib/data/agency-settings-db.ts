import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_AGENCY_SETTINGS } from '@/data/agency-settings';
import type { AgencySettingsRow } from '@/types/database';
import { normalizeAgencyCurrency, type AgencyCurrencyIso } from '@/lib/money/format-money';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getAgencySettingsRow(): Promise<AgencySettingsRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('agency_settings').select('*').eq('id', 1).maybeSingle();
  if (error) {
    console.error('agency_settings:', error.message);
    return null;
  }
  return data as AgencySettingsRow | null;
}

/** Devise d’affichage (clé service / anon) à partir d’un client Supabase existant. */
export async function getAgencyDisplayCurrencyWithClient(
  supabase: SupabaseClient
): Promise<AgencyCurrencyIso> {
  const { data } = await supabase.from('agency_settings').select('default_currency').eq('id', 1).maybeSingle();
  return normalizeAgencyCurrency(data?.default_currency ?? DEFAULT_AGENCY_SETTINGS.defaultCurrency);
}

/** Devise d’affichage globale (Paramètres agence), normalisée ISO. Dédupliquée par requête. */
export const getAgencyDisplayCurrency = cache(async (): Promise<AgencyCurrencyIso> => {
  const supabase = await createClient();
  return getAgencyDisplayCurrencyWithClient(supabase);
});
