import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageAllTasks } from '@/lib/auth/capabilities';
import { hasFullOrgDataAccess, taskListingDenied, shouldScopeTasksToAssignee } from '@/lib/auth/data-scope';
import { fetchVideoIdsAssignedToEmployee } from '@/lib/data/video-assignments';
import type { Employee, UserRole } from '@/types/database';
import {
  coerceOperationalSkills,
  employeeCanBeVideoCameraman,
  employeeCanBeVideoEditor,
} from '@/lib/employees/operational-skills';

export type VideoAssignEmployeeRow = Pick<Employee, 'id' | 'full_name' | 'role' | 'operational_skills'>;

function mapVideoAssignRow(row: {
  id: string;
  full_name: string;
  role: UserRole;
  operational_skills?: unknown;
}): VideoAssignEmployeeRow {
  return {
    id: row.id,
    full_name: row.full_name,
    role: row.role,
    operational_skills: coerceOperationalSkills(row.operational_skills),
  };
}

export async function listEmployeesForSelect(
  ctx: AuthContext | null = null
): Promise<Pick<Employee, 'id' | 'full_name' | 'role'>[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role) return [];

  if (taskListingDenied(auth)) return [];

  if (shouldScopeTasksToAssignee(auth) && auth.employee && !canManageAllTasks(auth.role)) {
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, role')
      .eq('id', auth.employee.id)
      .maybeSingle();
    return data ? [data] : [];
  }

  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, role')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('full_name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Monteurs / cadreurs : pairs déjà présents sur les mêmes vidéos (+ soi), sans annuaire complet. */
export async function listEmployeesForVideoAssign(
  ctx: AuthContext | null = null
): Promise<VideoAssignEmployeeRow[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role || !auth.employee) return [];

  if (canManageAllTasks(auth.role) || auth.role === 'commercial' || hasFullOrgDataAccess(auth)) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, role, operational_skills')
      .eq('is_active', true)
      .is('archived_at', null)
      .order('full_name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => mapVideoAssignRow(r));
  }

  const eid = auth.employee.id;
  const { data: vids, error: e1 } = await supabase
    .from('videos')
    .select('editor_id, cameraman_id')
    .or(`editor_id.eq.${eid},cameraman_id.eq.${eid}`);
  if (e1) throw new Error(e1.message);

  const ids = new Set<string>([eid]);
  for (const v of vids ?? []) {
    if (v.editor_id) ids.add(v.editor_id);
    if (v.cameraman_id) ids.add(v.cameraman_id);
  }

  const vaVideoIds = await fetchVideoIdsAssignedToEmployee(supabase, eid);
  if (vaVideoIds.length) {
    const { data: co, error: eVa } = await supabase
      .from('video_assignments')
      .select('employee_id')
      .in('video_id', vaVideoIds);
    if (eVa) throw new Error(eVa.message);
    for (const r of co ?? []) {
      if (r.employee_id) ids.add(r.employee_id as string);
    }
  }

  const { data: skillRows, error: eSkill } = await supabase
    .from('employees')
    .select('id, full_name, role, operational_skills')
    .eq('is_active', true)
    .is('archived_at', null);
  if (eSkill) throw new Error(eSkill.message);
  for (const r of skillRows ?? []) {
    const row = mapVideoAssignRow(r);
    if (employeeCanBeVideoEditor(row) || employeeCanBeVideoCameraman(row)) ids.add(row.id);
  }

  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, role, operational_skills')
    .in('id', [...ids])
    .eq('is_active', true)
    .is('archived_at', null)
    .order('full_name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapVideoAssignRow(r));
}
