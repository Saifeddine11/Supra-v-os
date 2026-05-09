import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import {
  effectiveRole,
  fetchManagedClientIds,
  hasFullOrgDataAccess,
} from '@/lib/auth/data-scope';

export type ProjectOption = {
  id: string;
  title: string;
  client_id: string;
  clients: { name: string } | null;
};

type ProjectRowRaw = {
  id: string;
  title: string;
  client_id: string;
  clients: { name: string } | { name: string }[] | null;
};

function normalizeJoinedClient(v: ProjectRowRaw['clients']): { name: string } | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function isProjectRouteRole(role: AuthContext['role']): boolean {
  if (!role) return false;
  if (role === 'finance' || role === 'editor' || role === 'cameraman' || role === 'community_manager') {
    return false;
  }
  return true;
}

export async function listProjectsForSelect(
  ctx: AuthContext | null = null
): Promise<ProjectOption[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role || !isProjectRouteRole(auth.role)) return [];

  let q = supabase.from('projects').select('id, title, client_id, clients(name)').order('updated_at', { ascending: false });

  if (hasFullOrgDataAccess(auth)) {
    // no filter
  } else if (auth.role === 'commercial' && auth.employee) {
    const ids = await fetchManagedClientIds(supabase, auth.employee.id);
    if (!ids.length) return [];
    q = q.in('client_id', ids);
  } else {
    const er = effectiveRole(auth.role);
    const eid = auth.employee?.id;
    if (!eid || (er !== 'developer' && er !== 'seo')) return [];
    q = q.or(`lead_id.eq.${eid},team_ids.cs.{${eid}}`);
    if (er === 'seo') q = q.ilike('type', '%seo%');
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ProjectRowRaw[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    client_id: row.client_id,
    clients: normalizeJoinedClient(row.clients),
  }));
}
