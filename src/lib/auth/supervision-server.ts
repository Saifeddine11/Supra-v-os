import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthContext } from '@/lib/auth/permissions';
import { actionError, type ActionResult } from '@/lib/actions/types';
import {
  canAssignTaskToEmployee,
  canManageEmployee,
  canManageTask,
  isDepartmentSupervisor,
  isDirection,
  isProjectManager,
  resolveEmployeeDepartment,
  supervisionActorFromEmployee,
  type SupervisionActor,
} from '@/lib/auth/supervision';
import type { Employee, TaskDepartment } from '@/types/database';

export function actorFromAuth(ctx: AuthContext): SupervisionActor {
  return supervisionActorFromEmployee(ctx.employee, ctx.role);
}

export function lockedTaskDepartmentForActor(ctx: AuthContext): TaskDepartment | null {
  if (!isDepartmentSupervisor(ctx.employee ?? ctx.role)) return null;
  return ctx.employee?.department ?? null;
}

export function resolveCreatedTaskDepartment(
  ctx: AuthContext,
  requested: TaskDepartment | null,
): { ok: true; value: TaskDepartment } | { ok: false; error: string } {
  if (isDepartmentSupervisor(ctx.employee ?? ctx.role)) {
    const dept = ctx.employee?.department ?? null;
    if (!dept) {
      return { ok: false, error: 'Votre pôle n’est pas renseigné : contactez Direction.' };
    }
    return { ok: true, value: dept };
  }
  if (!requested) return { ok: false, error: 'Le département est requis.' };
  return { ok: true, value: requested };
}

export function resolveUpdatedTaskDepartment(
  ctx: AuthContext,
  requested: TaskDepartment | null,
  current: TaskDepartment | null,
): { ok: true; value: TaskDepartment | null } | { ok: false; error: string } {
  if (isDepartmentSupervisor(ctx.employee ?? ctx.role)) {
    const dept = ctx.employee?.department ?? null;
    if (!dept) {
      return { ok: false, error: 'Votre pôle n’est pas renseigné : contactez Direction.' };
    }
    if (current && current !== dept) {
      return { ok: false, error: 'Cette tâche n’appartient pas à votre pôle.' };
    }
    return { ok: true, value: dept };
  }
  return { ok: true, value: requested };
}

export async function assertAssigneesInSupervisionScope(
  sb: SupabaseClient,
  ctx: AuthContext,
  assigneeIds: string[],
  taskDepartment: TaskDepartment | null,
): Promise<ActionResult<never> | null> {
  if (assigneeIds.length === 0) return null;
  if (isDirection(ctx.role) || isProjectManager(ctx.role)) return null;

  const actor = actorFromAuth(ctx);
  const { data, error } = await sb
    .from('employees')
    .select('id, role, department, operational_skills')
    .in('id', assigneeIds);
  if (error) return actionError(error.message);

  const byId = new Map((data ?? []).map((row) => [row.id as string, row]));
  for (const id of assigneeIds) {
    const row = byId.get(id);
    if (!row) return actionError('Collaborateur introuvable pour l’assignation.');
    const employeeDept = resolveEmployeeDepartment(row as Pick<Employee, 'department' | 'role' | 'operational_skills'>);
    if (
      !canAssignTaskToEmployee(
        actor,
        { id, department: employeeDept },
        { department: taskDepartment },
      )
    ) {
      return actionError('Vous ne pouvez assigner que des membres de votre pôle.');
    }
  }
  return null;
}

export function assertActorCanManageTaskRow(
  ctx: AuthContext,
  task: { department: TaskDepartment | null; assignee_id?: string | null },
): boolean {
  const actor = actorFromAuth(ctx);
  if (canManageTask(actor, task)) return true;
  const eid = ctx.employee?.id;
  if (eid && task.assignee_id === eid) return true;
  return false;
}

export function assertActorCanViewEmployeeRow(
  ctx: AuthContext,
  employee: { department: TaskDepartment | null; id?: string },
): boolean {
  if (employee.id && ctx.employee?.id === employee.id) return true;
  return canManageEmployee(actorFromAuth(ctx), employee);
}
