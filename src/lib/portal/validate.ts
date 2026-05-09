import { createAdminClient } from '@/lib/supabase/admin';
import type { ClientPortal } from '@/types/database';

export type PortalValidation =
  | { ok: true; portal: ClientPortal }
  | { ok: false; reason: 'missing_token' | 'invalid' | 'inactive' | 'expired' };

export async function validatePortalToken(
  clientId: string,
  token: string | null | undefined
): Promise<PortalValidation> {
  const t = token?.trim();
  if (!t) return { ok: false, reason: 'missing_token' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('client_portals')
    .select('*')
    .eq('client_id', clientId)
    .eq('token', t)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: 'invalid' };
  if (!data.is_active) return { ok: false, reason: 'inactive' };
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, portal: data };
}

/** Aligné sur l’UI portail : le client ne peut valider / demander révision que dans ces états. */
export function portalVideoAllowsClientAction(row: {
  status: string;
  public_status: string;
}): boolean {
  return (
    row.public_status === 'in_validation' ||
    row.status === 'sent_to_client' ||
    row.status === 'internal_review'
  );
}

export async function recordPortalAccess(portalId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from('client_portals').select('access_count').eq('id', portalId).single();
  const next = (data?.access_count ?? 0) + 1;
  await admin
    .from('client_portals')
    .update({
      access_count: next,
      last_accessed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', portalId);
}
