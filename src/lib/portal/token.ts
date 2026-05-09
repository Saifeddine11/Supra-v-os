/**
 * Client portal token utilities
 * --------------------------------------------------------------------------
 * Tokens are random 64-character hex strings stored in `client_portals.token`.
 *
 * Validation runs server-side using the admin client (bypasses RLS).
 * The portal then loads ONLY the requested client's data, filtered through
 * `lib/portal/filters.ts` to strip internal fields before sending to the
 * browser.
 */

import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/** Row partielle pour la validation token (évite inférence `never` sur le client admin). */
type PortalTokenRow = {
  client_id: string;
  is_active: boolean;
  expires_at: string | null;
  access_count: number | null;
};

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export interface PortalValidationResult {
  valid: boolean;
  clientId?: string;
  reason?: 'not_found' | 'inactive' | 'expired' | 'mismatch';
}

/**
 * Validate that a token belongs to a given client and is still active.
 * Updates last_accessed_at + access_count when valid.
 */
export async function validatePortalToken(
  clientId: string,
  token: string
): Promise<PortalValidationResult> {
  if (!clientId || !token) return { valid: false, reason: 'mismatch' };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('client_portals')
    .select('client_id, is_active, expires_at, access_count')
    .eq('token', token)
    .single();

  if (error || !data) return { valid: false, reason: 'not_found' };

  const row = data as PortalTokenRow;
  if (row.client_id !== clientId) return { valid: false, reason: 'mismatch' };
  if (!row.is_active) return { valid: false, reason: 'inactive' };
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { valid: false, reason: 'expired' };
  }

  // Track access (fire-and-forget). Cast: certains builds PostgREST infèrent `Update` comme `never`
  // sur ce client typé ; le payload reste valide pour `client_portals`.
  admin
    .from('client_portals')
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: (row.access_count ?? 0) + 1,
    } as never)
    .eq('token', token)
    .then(() => undefined);

  return { valid: true, clientId: row.client_id };
}
