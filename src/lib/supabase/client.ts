/**
 * Supabase BROWSER client
 * --------------------------------------------------------------------------
 * Use in Client Components ('use client'). RLS is enforced — the user's
 * session JWT is automatically attached to every request.
 *
 * Usage:
 *   import { createClient } from '@/lib/supabase/client';
 *   const supabase = createClient();
 *
 * Env (browser): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY only.
 * Never use the service role key in the browser.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';

function readPublicSupabaseEnv(): { url: string; anonKey: string } {
  const url = normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    const missing: string[] = [];
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    console.error(
      '[Supabase] Variables manquantes pour le client navigateur:',
      missing.join(', '),
      '— Définissez-les dans .env.local puis redémarrez npm run dev.'
    );
    throw new Error(
      'Configuration Supabase incomplète : ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local, puis relancez le serveur de dev.'
    );
  }

  return { url, anonKey };
}

/** Masque la clé anon pour les logs (ne jamais logger la clé complète). */
export function maskPublicAnonKey(anonKey: string | undefined): string {
  const k = anonKey?.trim();
  if (!k) return '(absent)';
  if (k.length < 24) return `(${k.length} caractères — probablement invalide)`;
  return `${k.slice(0, 12)}…${k.slice(-8)} (${k.length} car.)`;
}

/** Log unique en dev pour vérifier que les vars public Supabase sont injectées au build. */
let devEnvLogged = false;
export function logSupabaseBrowserEnvDev(): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (devEnvLogged) return;
  devEnvLogged = true;

  const url = normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.info('[Supabase browser — dev check]', {
    NEXT_PUBLIC_SUPABASE_URL: url || '(MANQUANT)',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: maskPublicAnonKey(key),
  });
  if (!url || !key?.trim()) {
    console.error(
      '[Supabase] Corrigez .env.local puis redémarrez le serveur — sans ces variables, signInWithPassword échouera.'
    );
  }
}

export function createClient() {
  const { url, anonKey } = readPublicSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
