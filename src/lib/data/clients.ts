import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import { resolveVisibleClientIds } from '@/lib/auth/data-scope';
import type { Client, ClientStatus } from '@/types/database';
import { clampSearchInput, parseUuidParam } from '@/lib/security/input-validation';

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

  let q = supabase.from('clients').select('*').order('name');
  if (scope !== 'all') q = q.in('id', scope);

  if (filters.status && filters.status !== 'all') {
    q = q.eq('status', filters.status);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  let rows = data ?? [];
  const s = clampSearchInput(filters.search, 200).toLowerCase();
  if (s) {
    rows = rows.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (c.email?.toLowerCase().includes(s) ?? false) ||
        (c.city?.toLowerCase().includes(s) ?? false) ||
        c.sector.toLowerCase().includes(s)
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
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !auth?.role) return null;

  const scope = await resolveVisibleClientIds(supabase, auth);
  if (scope !== 'all' && !scope.includes(id)) return null;

  return data;
}
