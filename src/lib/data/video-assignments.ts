import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VideoAssignmentRole } from '@/types/database';

export type VideoAssigneeRef = { id: string; full_name: string };

type SB = SupabaseClient;

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
}

/** IDs vidéo où l’employé a au moins une assignation (rôle editor ou cameraman). */
export async function fetchVideoIdsAssignedToEmployee(sb: SB, employeeId: string): Promise<string[]> {
  const { data, error } = await sb.from('video_assignments').select('video_id').eq('employee_id', employeeId);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.video_id as string))];
}

export async function fetchVideoIdsForAssignmentRole(
  sb: SB,
  employeeId: string,
  role: VideoAssignmentRole,
): Promise<string[]> {
  const { data, error } = await sb
    .from('video_assignments')
    .select('video_id')
    .eq('employee_id', employeeId)
    .eq('assignment_role', role);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.video_id as string))];
}

export async function employeeHasVideoAssignment(
  sb: SB,
  videoId: string,
  employeeId: string,
  role: VideoAssignmentRole | 'any',
): Promise<boolean> {
  let q = sb.from('video_assignments').select('id').eq('video_id', videoId).eq('employee_id', employeeId).limit(1);
  if (role !== 'any') q = q.eq('assignment_role', role);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function fetchAssignmentsForVideos(
  sb: SB,
  videoIds: string[]
): Promise<Map<string, { editors: VideoAssigneeRef[]; cameramen: VideoAssigneeRef[] }>> {
  const out = new Map<string, { editors: VideoAssigneeRef[]; cameramen: VideoAssigneeRef[] }>();
  if (videoIds.length === 0) return out;
  for (const vid of videoIds) {
    out.set(vid, { editors: [], cameramen: [] });
  }
  const { data, error } = await sb
    .from('video_assignments')
    .select('video_id, assignment_role, employee_id')
    .in('video_id', videoIds);
  if (error) throw new Error(error.message);
  const empIds = [...new Set((data ?? []).map((r) => r.employee_id as string).filter(Boolean))];
  const nameMap = new Map<string, string>();
  if (empIds.length > 0) {
    const { data: emps, error: e2 } = await sb.from('employees').select('id, full_name').in('id', empIds);
    if (e2) throw new Error(e2.message);
    for (const e of emps ?? []) nameMap.set(e.id as string, String((e as { full_name: string }).full_name));
  }
  for (const row of data ?? []) {
    const vid = row.video_id as string;
    const role = row.assignment_role as VideoAssignmentRole;
    const eid = row.employee_id as string;
    const nm = nameMap.get(eid) ?? '—';
    const ref: VideoAssigneeRef = { id: eid, full_name: nm };
    const bucket = out.get(vid);
    if (!bucket) continue;
    if (role === 'editor') bucket.editors.push(ref);
    else bucket.cameramen.push(ref);
  }
  for (const [, v] of out) {
    v.editors.sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr', { sensitivity: 'base' }));
    v.cameramen.sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr', { sensitivity: 'base' }));
  }
  return out;
}

/** Remplace toutes les assignations d’une vidéo (transaction logique : delete puis insert). */
export async function replaceVideoAssignments(
  sb: SB,
  videoId: string,
  editorIds: string[],
  cameramanIds: string[],
): Promise<void> {
  const editors = dedupeIds(editorIds);
  const cameramen = dedupeIds(cameramanIds);
  const { error: delErr } = await sb.from('video_assignments').delete().eq('video_id', videoId);
  if (delErr) throw new Error(delErr.message);
  const rows: { video_id: string; employee_id: string; assignment_role: VideoAssignmentRole }[] = [
    ...editors.map((employee_id) => ({ video_id: videoId, employee_id, assignment_role: 'editor' as const })),
    ...cameramen.map((employee_id) => ({ video_id: videoId, employee_id, assignment_role: 'cameraman' as const })),
  ];
  if (rows.length === 0) return;
  const { error: insErr } = await sb.from('video_assignments').insert(rows);
  if (insErr) throw new Error(insErr.message);
}

export function legacyPrimaryAssignees(editorIds: string[], cameramanIds: string[]) {
  return {
    editor_id: editorIds[0] ?? null,
    cameraman_id: cameramanIds[0] ?? null,
  };
}

/** Libellés « Nom, Nom » pour tableaux. */
export function formatAssigneeNames(people: VideoAssigneeRef[]): string {
  if (people.length === 0) return '—';
  return people.map((p) => p.full_name).join(', ');
}

/** Drapeaux tournage / montage pour un employé sur chaque vidéo (pivot + colonnes legacy). */
export type EmployeeVideoRoleFlags = { hasEditor: boolean; hasCameraman: boolean };

export async function fetchMyVideoRoleFlagsForVideos(
  sb: SB,
  employeeId: string,
  rows: { id: string; editor_id?: string | null; cameraman_id?: string | null }[],
): Promise<Map<string, EmployeeVideoRoleFlags>> {
  const map = new Map<string, EmployeeVideoRoleFlags>();
  const videoIds = rows.map((r) => r.id);
  for (const id of videoIds) {
    map.set(id, { hasEditor: false, hasCameraman: false });
  }
  if (videoIds.length === 0) return map;

  const { data, error } = await sb
    .from('video_assignments')
    .select('video_id, assignment_role')
    .eq('employee_id', employeeId)
    .in('video_id', videoIds);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    const vid = r.video_id as string;
    const bucket = map.get(vid);
    if (!bucket) continue;
    const role = r.assignment_role as VideoAssignmentRole;
    if (role === 'editor') bucket.hasEditor = true;
    if (role === 'cameraman') bucket.hasCameraman = true;
  }
  for (const row of rows) {
    const b = map.get(row.id);
    if (!b) continue;
    if (row.editor_id === employeeId) b.hasEditor = true;
    if (row.cameraman_id === employeeId) b.hasCameraman = true;
  }
  return map;
}
