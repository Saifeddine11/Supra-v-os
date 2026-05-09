/**
 * Normalise l’URL projet Supabase (copier-coller depuis le dashboard).
 * - Retire un suffixe erroné /rest/v1/…
 * - Retire les slashs finaux
 */

export function normalizeSupabaseProjectUrl(raw: string | undefined): string {
  let s = raw?.trim() ?? '';
  if (!s) return s;
  s = s.replace(/\/rest\/v1\/?.*$/i, '');
  s = s.replace(/\/+$/, '');
  return s;
}
