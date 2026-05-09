/**
 * Supabase ADMIN client (service role)
 * --------------------------------------------------------------------------
 * ⚠️  SERVER-ONLY. Bypasses Row Level Security.
 *
 * Use ONLY for:
 *   - Portal token validation (clients have no auth session)
 *   - Cron jobs (morning reminders, deadline alerts, overdue invoice marking)
 *   - PDF generation (need to fetch invoices regardless of caller's role)
 *   - Admin maintenance scripts
 *
 * NEVER use in Client Components or expose service_role key to the browser.
 * NEVER use to handle a request that should respect RLS — use the regular
 * server client (`./server.ts`) instead.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';

/** Schéma TS maison ≠ helper PostgREST — typage large pour éviter `never` sur `.from()`. */
export type ServiceRoleClient = SupabaseClient<any, 'public', any>;

let cached: ServiceRoleClient | null = null;

/** À appeler après rotation de la clé service_role sans redémarrer (rare). */
export function resetAdminClientCache() {
  cached = null;
}

/**
 * Après rotation de SUPABASE_SERVICE_ROLE_KEY, redémarrez `npm run dev`
 * (ou appelez resetAdminClientCache) — ne jamais logger la clé.
 */
export function createAdminClient(): ServiceRoleClient {
  if (cached) return cached;

  const url = normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase admin credentials. Ensure NEXT_PUBLIC_SUPABASE_URL ' +
      'and SUPABASE_SERVICE_ROLE_KEY are set in the environment.'
    );
  }

  cached = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as ServiceRoleClient;

  return cached;
}
