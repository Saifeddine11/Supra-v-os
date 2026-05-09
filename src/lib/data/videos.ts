import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import {
  assertVideoRecordVisible,
  effectiveRole,
  hasFullOrgDataAccess,
} from '@/lib/auth/data-scope';
import type { Video } from '@/types/database';

export type VideoWithClient = Video & {
  clients: { name: string } | null;
  editor_name: string | null;
  cameraman_name: string | null;
};

async function enrichVideoRows(
  rows: (Video & { clients: { name: string } | null })[]
): Promise<VideoWithClient[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const empIds = [
    ...new Set(
      rows.flatMap((v) => [v.editor_id, v.cameraman_id].filter(Boolean) as string[])
    ),
  ];
  if (empIds.length === 0) {
    return rows.map((v) => ({ ...v, editor_name: null, cameraman_name: null }));
  }
  const { data: emps, error } = await supabase.from('employees').select('id, full_name').in('id', empIds);
  if (error) throw new Error(error.message);
  const map = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
  return rows.map((v) => ({
    ...v,
    editor_name: v.editor_id ? map.get(v.editor_id) ?? null : null,
    cameraman_name: v.cameraman_id ? map.get(v.cameraman_id) ?? null : null,
  }));
}

export async function listVideosWithClients(
  ctx: AuthContext | null = null
): Promise<VideoWithClient[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role) return [];

  let q = supabase
    .from('videos')
    .select('*, clients(name)')
    .order('delivery_deadline', { ascending: true, nullsFirst: false });

  if (hasFullOrgDataAccess(auth) || auth.role === 'commercial') {
    // pas de filtre supplémentaire
  } else {
    const er = effectiveRole(auth.role);
    const eid = auth.employee?.id;
    if (!eid) return [];
    if (er === 'editor') q = q.eq('editor_id', eid);
    else if (er === 'cameraman') q = q.eq('cameraman_id', eid);
    else if (er === 'community_manager') q = q.or(`editor_id.eq.${eid},cameraman_id.eq.${eid}`);
    else return [];
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return enrichVideoRows((data ?? []) as (Video & { clients: { name: string } | null })[]);
}

export async function getVideoById(
  id: string,
  ctx: AuthContext | null = null
): Promise<VideoWithClient | null> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role) return null;

  const { data, error } = await supabase
    .from('videos')
    .select('*, clients(name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  if (!(await assertVideoRecordVisible(supabase, auth, id))) return null;

  const [enriched] = await enrichVideoRows([data as Video & { clients: { name: string } | null }]);
  return enriched ?? null;
}
