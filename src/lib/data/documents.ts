import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import {
  effectiveRole,
  fetchManagedClientIds,
  hasFullOrgDataAccess,
} from '@/lib/auth/data-scope';
import type { DocumentRecord } from '@/types/database';

export type DocumentWithRelations = DocumentRecord & {
  clients: { name: string; id: string } | null;
  projects: { title: string; id: string } | null;
};

type SB = Awaited<ReturnType<typeof createClient>>;

/** Filtre PostgREST `.or(...)` ou sentinelles : `null` = pas de filtre, `__none__` = aucun résultat. */
async function buildDocumentsOrFilter(sb: SB, auth: AuthContext): Promise<string | null | '__none__'> {
  if (!auth.employee) return '__none__';
  const eid = auth.employee.id;

  if (hasFullOrgDataAccess(auth)) return null;

  if (auth.role === 'finance') return '__none__';

  if (auth.role === 'commercial') {
    const managed = await fetchManagedClientIds(sb, eid);
    if (!managed.length) return '__none__';
    const { data: projs } = await sb.from('projects').select('id').in('client_id', managed);
    const pids = [...new Set((projs ?? []).map((p) => p.id))];
    const { data: vids } = await sb.from('videos').select('id').in('client_id', managed);
    const vidsIds = [...new Set((vids ?? []).map((v) => v.id))];
    const parts: string[] = [];
    if (managed.length) parts.push(`client_id.in.(${managed.join(',')})`);
    if (pids.length) parts.push(`project_id.in.(${pids.join(',')})`);
    if (vidsIds.length) parts.push(`video_id.in.(${vidsIds.join(',')})`);
    return parts.length ? parts.join(',') : '__none__';
  }

  const er = effectiveRole(auth.role);

  if (er === 'editor' || er === 'cameraman' || er === 'community_manager') {
    const { data: vids } = await sb
      .from('videos')
      .select('id')
      .or(`editor_id.eq.${eid},cameraman_id.eq.${eid}`);
    const vidIds = [...new Set((vids ?? []).map((v) => v.id))];
    if (!vidIds.length) return '__none__';
    return `video_id.in.(${vidIds.join(',')})`;
  }

  if (er === 'developer') {
    const { data: projs } = await sb
      .from('projects')
      .select('id')
      .or(`lead_id.eq.${eid},team_ids.cs.{${eid}}`);
    const pids = [...new Set((projs ?? []).map((p) => p.id))];
    if (!pids.length) return '__none__';
    return `project_id.in.(${pids.join(',')})`;
  }

  if (er === 'seo') {
    const { data: projs } = await sb
      .from('projects')
      .select('id')
      .or(`lead_id.eq.${eid},team_ids.cs.{${eid}}`)
      .ilike('type', '%seo%');
    const pids = [...new Set((projs ?? []).map((p) => p.id))];
    if (!pids.length) return '__none__';
    return `project_id.in.(${pids.join(',')})`;
  }

  return '__none__';
}

export async function listDocumentsWithRelations(
  opts?: { includeArchived?: boolean },
  ctx: AuthContext | null = null
): Promise<DocumentWithRelations[]> {
  const auth = ctx ?? (await getAuthContext());
  const sb = await createClient();
  if (!auth?.role) return [];

  const orFilter = await buildDocumentsOrFilter(sb, auth);
  if (orFilter === '__none__') return [];

  let q = sb
    .from('documents')
    .select('*, clients(name, id), projects(title, id)')
    .order('uploaded_at', { ascending: false });

  if (orFilter) q = q.or(orFilter);

  if (!opts?.includeArchived) {
    q = q.is('archived_at', null);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentWithRelations[];
}
