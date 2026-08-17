import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import {
  assertVideoRecordVisible,
  effectiveRole,
  hasFullOrgDataAccess,
} from '@/lib/auth/data-scope';
import type { Video } from '@/types/database';
import { effectiveClientDeliveryIso } from '@/lib/videos/video-schedule';
import {
  fetchAssignmentsForVideos,
  fetchVideoIdsAssignedToEmployee,
  fetchVideoIdsForAssignmentRole,
  formatAssigneeNames,
  type VideoAssigneeRef,
} from '@/lib/data/video-assignments';
import { withDevTime } from '@/lib/perf/dev-time';

export type VideoWithClient = Video & {
  clients: { name: string; color_hex: string | null } | null;
  /** Libellés concaténés (liste / legacy). */
  editor_name: string | null;
  cameraman_name: string | null;
  editors: VideoAssigneeRef[];
  cameramen: VideoAssigneeRef[];
};

async function enrichVideoRows(
  rows: (Video & { clients: { name: string; color_hex: string | null } | null })[]
): Promise<VideoWithClient[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const videoIds = rows.map((r) => r.id);
  const assignMap = await fetchAssignmentsForVideos(supabase, videoIds);
  const allEmpIds = new Set<string>();
  for (const v of rows) {
    if (v.editor_id) allEmpIds.add(v.editor_id);
    if (v.cameraman_id) allEmpIds.add(v.cameraman_id);
    const a = assignMap.get(v.id);
    if (a) {
      a.editors.forEach((e) => allEmpIds.add(e.id));
      a.cameramen.forEach((e) => allEmpIds.add(e.id));
    }
  }
  const nameMap = new Map<string, string>();
  if (allEmpIds.size > 0) {
    const { data: emps, error } = await supabase.from('employees').select('id, full_name').in('id', [...allEmpIds]);
    if (error) throw new Error(error.message);
    for (const e of emps ?? []) nameMap.set(e.id as string, String((e as { full_name: string }).full_name));
  }
  return rows.map((v) => {
    let editors = [...(assignMap.get(v.id)?.editors ?? [])];
    let cameramen = [...(assignMap.get(v.id)?.cameramen ?? [])];
    if (editors.length === 0 && v.editor_id) {
      editors = [{ id: v.editor_id, full_name: nameMap.get(v.editor_id) ?? '—' }];
    }
    if (cameramen.length === 0 && v.cameraman_id) {
      cameramen = [{ id: v.cameraman_id, full_name: nameMap.get(v.cameraman_id) ?? '—' }];
    }
    return {
      ...v,
      editors,
      cameramen,
      editor_name: editors.length ? formatAssigneeNames(editors) : null,
      cameraman_name: cameramen.length ? formatAssigneeNames(cameramen) : null,
    };
  });
}

export async function listVideosWithClients(
  ctx: AuthContext | null = null
): Promise<VideoWithClient[]> {
  return withDevTime('videos list', () => listVideosWithClientsInner(ctx));
}

async function listVideosWithClientsInner(
  ctx: AuthContext | null = null
): Promise<VideoWithClient[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role) return [];

  let q = supabase
    .from('videos')
    .select('*, clients(name, color_hex)')
    .order('delivery_deadline', { ascending: true, nullsFirst: false });

  if (hasFullOrgDataAccess(auth) || auth.role === 'commercial') {
    // pas de filtre supplémentaire
  } else {
    const er = effectiveRole(auth.role);
    const eid = auth.employee?.id;
    if (!eid) return [];
    if (er === 'editor') {
      const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, eid);
      const parts = [`editor_id.eq.${eid}`, `cameraman_id.eq.${eid}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      q = q.or(parts.join(','));
    } else if (er === 'cameraman') {
      const fromVa = await fetchVideoIdsForAssignmentRole(supabase, eid, 'cameraman');
      const parts = [`cameraman_id.eq.${eid}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      q = q.or(parts.join(','));
    } else if (er === 'community_manager') {
      const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, eid);
      const parts = [`editor_id.eq.${eid}`, `cameraman_id.eq.${eid}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      q = q.or(parts.join(','));
    } else return [];
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const enriched = await enrichVideoRows(
    (data ?? []) as (Video & { clients: { name: string; color_hex: string | null } | null })[],
  );
  enriched.sort((a, b) => {
    const ta = effectiveClientDeliveryIso(a);
    const tb = effectiveClientDeliveryIso(b);
    const da = ta ? new Date(ta).getTime() : Infinity;
    const db = tb ? new Date(tb).getTime() : Infinity;
    return da - db;
  });
  return enriched;
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
    .select('*, clients(name, color_hex)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  if (!(await assertVideoRecordVisible(supabase, auth, id))) return null;

  const [enriched] = await enrichVideoRows([
    data as Video & { clients: { name: string; color_hex: string | null } | null },
  ]);
  return enriched ?? null;
}
