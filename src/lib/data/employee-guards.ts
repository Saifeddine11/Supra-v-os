import type { SupabaseClient } from '@supabase/supabase-js';
import type { Employee } from '@/types/database';
import { actionError, actionOk, type ActionResult } from '@/lib/actions/types';
import {
  employeeCanBeVideoCameraman,
  employeeCanBeVideoEditor,
} from '@/lib/employees/operational-skills';

type SB = SupabaseClient;

/** Block assigning new work to inactive or archived members. */
export async function requireAssignableEmployee(
  supabase: SB,
  employeeId: string | null | undefined,
): Promise<ActionResult<void>> {
  if (!employeeId) return actionOk();
  const { data: raw, error } = await supabase
    .from('employees')
    .select('id, is_active, archived_at')
    .eq('id', employeeId)
    .maybeSingle();
  if (error) return actionError(error.message);
  const data = raw as Pick<Employee, 'id' | 'is_active' | 'archived_at'> | null;
  if (!data) return actionError('Collaborateur introuvable.');
  if (data.archived_at) {
    return actionError(
      'Ce collaborateur est archivé et ne peut pas recevoir de nouvelles assignations.',
    );
  }
  if (!data.is_active) {
    return actionError(
      'Ce collaborateur est inactif. Réactivez-le ou choisissez un autre membre.',
    );
  }
  return actionOk();
}

export async function requireAssignableAsVideoEditor(
  supabase: SB,
  employeeId: string | null | undefined,
): Promise<ActionResult<void>> {
  const base = await requireAssignableEmployee(supabase, employeeId);
  if (!base.ok) return base;
  if (!employeeId) return actionOk();
  const { data: raw, error } = await supabase
    .from('employees')
    .select('role, operational_skills')
    .eq('id', employeeId)
    .maybeSingle();
  if (error) return actionError(error.message);
  const row = raw as Pick<Employee, 'role' | 'operational_skills'> | null;
  if (!row) return actionError('Collaborateur introuvable.');
  if (!employeeCanBeVideoEditor(row)) {
    return actionError('Ce collaborateur n’a pas la compétence monteur pour cette assignation.');
  }
  return actionOk();
}

export async function requireAssignableAsVideoCameraman(
  supabase: SB,
  employeeId: string | null | undefined,
): Promise<ActionResult<void>> {
  const base = await requireAssignableEmployee(supabase, employeeId);
  if (!base.ok) return base;
  if (!employeeId) return actionOk();
  const { data: raw, error } = await supabase
    .from('employees')
    .select('role, operational_skills')
    .eq('id', employeeId)
    .maybeSingle();
  if (error) return actionError(error.message);
  const row = raw as Pick<Employee, 'role' | 'operational_skills'> | null;
  if (!row) return actionError('Collaborateur introuvable.');
  if (!employeeCanBeVideoCameraman(row)) {
    return actionError('Ce collaborateur n’a pas la compétence cadreur pour cette assignation.');
  }
  return actionOk();
}

/** Active, non-archived admins excluding one employee (for last-admin checks). */
export async function countActiveAdminsExcluding(supabase: SB, excludeEmployeeId: string): Promise<number> {
  const { count, error } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('is_active', true)
    .is('archived_at', null)
    .neq('id', excludeEmployeeId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function assertKeepsActiveAdmin(
  supabase: SB,
  targetId: string,
  targetWasActiveAdmin: boolean,
): Promise<ActionResult<void>> {
  if (!targetWasActiveAdmin) return actionOk();
  const n = await countActiveAdminsExcluding(supabase, targetId);
  if (n < 1) {
    return actionError(
      'Action impossible : il doit rester au moins un administrateur actif et non archivé.',
    );
  }
  return actionOk();
}

function isActiveAdminRow(row: {
  role: string;
  is_active: boolean;
  archived_at: string | null;
}): boolean {
  return row.role === 'admin' && row.is_active && row.archived_at == null;
}

export async function assertLastActiveAdminNotRemoved(
  supabase: SB,
  employeeId: string,
  nextRole: string,
  nextActive: boolean,
  nextArchivedAt: string | null,
): Promise<ActionResult<void>> {
  const { data: cur, error } = await supabase
    .from('employees')
    .select('role, is_active, archived_at')
    .eq('id', employeeId)
    .maybeSingle();
  if (error) return actionError(error.message);
  if (!cur) return actionError('Collaborateur introuvable.');

  const wasActiveAdmin = isActiveAdminRow(cur);
  if (!wasActiveAdmin) return actionOk();

  const removesActiveAdmin =
    nextRole !== 'admin' ||
    !nextActive ||
    nextArchivedAt !== null;

  if (!removesActiveAdmin) return actionOk();

  return assertKeepsActiveAdmin(supabase, employeeId, true);
}

/** Returns true if employee has FK-related history (block hard delete). */
export async function employeeHasBlockingRelations(supabase: SB, employeeId: string): Promise<boolean> {
  const [tasks, vEd, vCam, proj, int, clients] = await Promise.all([
    supabase.from('tasks').select('id').eq('assignee_id', employeeId).limit(1),
    supabase.from('videos').select('id').eq('editor_id', employeeId).limit(1),
    supabase.from('videos').select('id').eq('cameraman_id', employeeId).limit(1),
    supabase.from('projects').select('id').eq('lead_id', employeeId).limit(1),
    supabase.from('internal_projects').select('id').eq('owner_id', employeeId).limit(1),
    supabase.from('clients').select('id').eq('account_manager_id', employeeId).limit(1),
  ]);
  const has =
    (tasks.data?.length ?? 0) > 0 ||
    (vEd.data?.length ?? 0) > 0 ||
    (vCam.data?.length ?? 0) > 0 ||
    (proj.data?.length ?? 0) > 0 ||
    (int.data?.length ?? 0) > 0 ||
    (clients.data?.length ?? 0) > 0;
  return has;
}
