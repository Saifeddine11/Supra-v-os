/**
 * Department supervision — métier stays on employees.role.
 * Management flag: employees.is_department_supervisor.
 * Scope: employees.department (same enum as tasks.department).
 */
import type { Employee, TaskDepartment, UserRole } from '@/types/database';
import { OPERATIONAL_SKILL_ROLES, TASK_DEPARTMENT_MAP } from '@/types/domain';

export type SupervisionActor = {
  role: UserRole | null;
  department: TaskDepartment | null;
  is_department_supervisor?: boolean;
};

export type SupervisionEmployee = {
  id?: string;
  role?: UserRole | null;
  department: TaskDepartment | null;
  is_department_supervisor?: boolean | null;
};

export type SupervisionTask = {
  department: TaskDepartment | null;
};

const JOB_ROLES_FOR_RESTORE = new Set<UserRole>(OPERATIONAL_SKILL_ROLES);

/** Job role → canonical pole. Admin / PM / finance / commercial stay unmapped. */
export const ROLE_TO_DEPARTMENT: Partial<Record<UserRole, TaskDepartment>> = {
  community_manager: 'community_management',
  editor: 'production_video',
  cameraman: 'production_video',
  developer: 'web_seo',
  designer: 'web_seo',
  seo: 'web_seo',
};

export const DEPARTMENT_DEFAULT_ROLE: Record<TaskDepartment, UserRole> = {
  production_video: 'editor',
  video_distribution: 'editor',
  community_management: 'community_manager',
  media_buying: 'commercial',
  web_seo: 'developer',
};

export function isDirection(role: UserRole | null): boolean {
  return role === 'admin';
}

export function isProjectManager(role: UserRole | null): boolean {
  return role === 'project_manager';
}

type SupervisorLike =
  | UserRole
  | null
  | undefined
  | {
      role?: UserRole | null;
      is_department_supervisor?: boolean | null;
    };

export function isDepartmentSupervisor(value: SupervisorLike): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value === 'department_supervisor';
  return value.is_department_supervisor === true || value.role === 'department_supervisor';
}

export function canViewTeamDirectory(role: UserRole | null, isSupervisor = false): boolean {
  return isDirection(role) || isProjectManager(role) || isDepartmentSupervisor(role) || isSupervisor;
}

export function departmentLabel(department: TaskDepartment | null | undefined): string {
  if (!department) return '—';
  return TASK_DEPARTMENT_MAP[department]?.label ?? department;
}

export function inferDepartmentFromRole(role: UserRole | null | undefined): TaskDepartment | null {
  if (!role) return null;
  return ROLE_TO_DEPARTMENT[role] ?? null;
}

export function inferDepartmentFromSkills(skills: UserRole[] | null | undefined): TaskDepartment | null {
  for (const skill of skills ?? []) {
    const dept = ROLE_TO_DEPARTMENT[skill];
    if (dept) return dept;
  }
  return null;
}

/** Canonical pole for an employee: stored department, else role, else skills. */
export function resolveEmployeeDepartment(
  employee:
    | Pick<Employee, 'department' | 'role' | 'operational_skills'>
    | {
        department?: TaskDepartment | null;
        role?: UserRole | null;
        operational_skills?: UserRole[] | null;
      },
): TaskDepartment | null {
  if (employee.department) return employee.department;
  const fromRole = inferDepartmentFromRole(employee.role ?? null);
  if (fromRole) return fromRole;
  return inferDepartmentFromSkills(employee.operational_skills ?? []);
}

export function restoreRoleAfterSupervision(
  employee: Pick<Employee, 'department' | 'operational_skills'> & { role?: UserRole | null },
): UserRole {
  if (employee.role && employee.role !== 'department_supervisor' && employee.role !== 'project_manager') {
    return employee.role;
  }
  for (const skill of employee.operational_skills ?? []) {
    if (JOB_ROLES_FOR_RESTORE.has(skill) && skill !== 'project_manager') return skill;
  }
  const dept = employee.department ?? null;
  if (dept) return DEPARTMENT_DEFAULT_ROLE[dept];
  return 'editor';
}

export function canSuperviseDepartment(
  actor: SupervisionActor,
  department: TaskDepartment | null | undefined,
): boolean {
  if (isDirection(actor.role) || isProjectManager(actor.role)) return true;
  if (!isDepartmentSupervisor(actor)) return false;
  if (!actor.department || !department) return false;
  return actor.department === department;
}

export function canManageEmployee(actor: SupervisionActor, employee: SupervisionEmployee): boolean {
  if (isDirection(actor.role) || isProjectManager(actor.role)) return true;
  return canSuperviseDepartment(actor, employee.department);
}

export function canManageTask(actor: SupervisionActor, task: SupervisionTask): boolean {
  if (isDirection(actor.role) || isProjectManager(actor.role)) return true;
  return canSuperviseDepartment(actor, task.department);
}

export function canAssignTaskToEmployee(
  actor: SupervisionActor,
  employee: SupervisionEmployee,
  task?: SupervisionTask | null,
): boolean {
  if (isDirection(actor.role) || isProjectManager(actor.role)) return true;
  if (!canManageEmployee(actor, employee)) return false;
  if (task && !canManageTask(actor, task)) return false;
  return true;
}

export function supervisionActorFromEmployee(
  employee: Pick<Employee, 'role' | 'department' | 'is_department_supervisor'> | null | undefined,
  role?: UserRole | null,
): SupervisionActor {
  return {
    role: role ?? employee?.role ?? null,
    department: employee?.department ?? null,
    is_department_supervisor: employee?.is_department_supervisor === true,
  };
}
