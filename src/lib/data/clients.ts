import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import { canViewClientContractFinancials } from '@/lib/auth/capabilities';
import { resolveVisibleClientIds } from '@/lib/auth/data-scope';
import type { Client, ClientStatus } from '@/types/database';
import { clampSearchInput, parseUuidParam } from '@/lib/security/input-validation';

/** Colonnes client sans forfait / devise (chef de projet, production). */
const CLIENT_SELECT_OPERATIONAL =
  'id,name,legal_name,sector,status,contract_type,primary_contact,email,phone,whatsapp,address,city,country,logo_url,avatar_initials,avatar_color,color_hex,color_label,services,monthly_video_quota,start_date,end_date,notes_internal,account_manager_id,created_at,updated_at,created_by' as const;

function normalizeClientRow(row: Record<string, unknown>): Client {
  const base = row as unknown as Client;
  return {
    ...base,
    monthly_fee: Number(row.monthly_fee ?? base.monthly_fee ?? 0),
    currency: String(row.currency ?? base.currency ?? 'MAD'),
  };
}

export interface ClientFilters {
  search?: string;
  status?: ClientStatus | 'all';
}

export async function listClients(
  filters: ClientFilters = {},
  ctx: AuthContext | null = null
): Promise<Client[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role) return [];

  const scope = await resolveVisibleClientIds(supabase, auth);
  if (scope !== 'all' && scope.length === 0) return [];

  const financial = canViewClientContractFinancials(auth.role);
  let q = financial
    ? supabase.from('clients').select('*').order('name')
    : supabase.from('clients').select(CLIENT_SELECT_OPERATIONAL).order('name');
  if (scope !== 'all') q = q.in('id', scope);

  if (filters.status && filters.status !== 'all') {
    q = q.eq('status', filters.status);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  let rows: Client[] = ((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeClientRow);
  const s = clampSearchInput(filters.search, 200).toLowerCase();
  if (s) {
    rows = rows.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (c.email?.toLowerCase().includes(s) ?? false) ||
        (c.city?.toLowerCase().includes(s) ?? false) ||
        c.sector.toLowerCase().includes(s),
    );
  }
  return rows;
}

export async function getClientById(
  id: string,
  ctx: AuthContext | null = null
): Promise<Client | null> {
  if (!parseUuidParam(id)) return null;
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role) return null;

  const financial = canViewClientContractFinancials(auth.role);
  const { data, error } = financial
    ? await supabase.from('clients').select('*').eq('id', id).maybeSingle()
    : await supabase.from('clients').select(CLIENT_SELECT_OPERATIONAL).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const scope = await resolveVisibleClientIds(supabase, auth);
  if (scope !== 'all' && !scope.includes(id)) return null;

  return normalizeClientRow(data as unknown as Record<string, unknown>);
}
