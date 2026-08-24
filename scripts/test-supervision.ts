/**
 * Helpers supervision de pôle — exécution : npx tsx scripts/test-supervision.ts
 */
import assert from 'node:assert/strict';
import {
  canAssignTaskToEmployee,
  canManageEmployee,
  canManageTask,
  canSuperviseDepartment,
  inferDepartmentFromRole,
  isDepartmentSupervisor,
  isDirection,
  isProjectManager,
  resolveEmployeeDepartment,
  restoreRoleAfterSupervision,
} from '../src/lib/auth/supervision';
import { canAssignTasks, canCreateTasks, canManageAllTasks, canViewGlobalFinanceStats } from '../src/lib/auth/capabilities';
import { canAccessPath } from '../src/lib/auth/nav-policy';

function main() {
  assert.equal(isDirection('admin'), true);
  assert.equal(isProjectManager('project_manager'), true);
  assert.equal(isDepartmentSupervisor('department_supervisor'), true);
  assert.equal(inferDepartmentFromRole('community_manager'), 'community_management');
  assert.equal(inferDepartmentFromRole('editor'), 'production_video');
  assert.equal(inferDepartmentFromRole('developer'), 'web_seo');
  assert.equal(inferDepartmentFromRole('admin'), null);

  const mariam = {
    role: 'department_supervisor' as const,
    department: 'community_management' as const,
  };
  assert.equal(canSuperviseDepartment(mariam, 'community_management'), true);
  assert.equal(canSuperviseDepartment(mariam, 'production_video'), false);
  assert.equal(canManageEmployee(mariam, { department: 'community_management' }), true);
  assert.equal(canManageEmployee(mariam, { department: 'web_seo' }), false);
  assert.equal(canManageTask(mariam, { department: 'community_management' }), true);
  assert.equal(canManageTask(mariam, { department: 'media_buying' }), false);
  assert.equal(
    canAssignTaskToEmployee(mariam, { department: 'community_management' }, { department: 'community_management' }),
    true,
  );
  assert.equal(
    canAssignTaskToEmployee(mariam, { department: 'production_video' }, { department: 'community_management' }),
    false,
  );

  const melyn = {
    role: 'community_manager' as const,
    department: 'community_management' as const,
    is_department_supervisor: true,
  };
  assert.equal(isDepartmentSupervisor(melyn), true);
  assert.equal(isDepartmentSupervisor({ role: 'community_manager', is_department_supervisor: false }), false);
  assert.equal(canSuperviseDepartment(melyn, 'community_management'), true);
  assert.equal(canSuperviseDepartment(melyn, 'production_video'), false);
  assert.equal(canAssignTasks('community_manager', true), true);
  assert.equal(canAssignTasks('community_manager', false), false);
  assert.equal(canAccessPath('community_manager', '/team', { isDepartmentSupervisor: true }), true);
  assert.equal(canAccessPath('community_manager', '/team'), false);
  assert.equal(canAccessPath('community_manager', '/invoices', { isDepartmentSupervisor: true }), false);

  const karim = {
    role: 'department_supervisor' as const,
    department: 'production_video' as const,
  };
  assert.equal(canManageTask(karim, { department: 'production_video' }), true);
  assert.equal(canManageTask(karim, { department: 'community_management' }), false);

  const direction = { role: 'admin' as const, department: null };
  assert.equal(canSuperviseDepartment(direction, 'web_seo'), true);
  assert.equal(canManageEmployee(direction, { department: 'media_buying' }), true);

  const pm = { role: 'project_manager' as const, department: null };
  assert.equal(canSuperviseDepartment(pm, 'community_management'), true);
  assert.equal(canManageAllTasks('project_manager'), true);
  assert.equal(canViewGlobalFinanceStats('project_manager'), false);
  assert.equal(canViewGlobalFinanceStats('department_supervisor'), false);
  assert.equal(canManageAllTasks('department_supervisor'), false);
  assert.equal(canCreateTasks('department_supervisor'), true);
  assert.equal(canAssignTasks('department_supervisor'), true);

  assert.equal(
    resolveEmployeeDepartment({
      department: null,
      role: 'community_manager',
      operational_skills: [],
    }),
    'community_management',
  );
  assert.equal(
    restoreRoleAfterSupervision({
      department: 'community_management',
      operational_skills: ['community_manager'],
      role: 'community_manager',
    }),
    'community_manager',
  );

  assert.equal(canAccessPath('department_supervisor', '/team'), true);
  assert.equal(canAccessPath('department_supervisor', '/tasks'), true);
  assert.equal(canAccessPath('department_supervisor', '/invoices'), false);
  assert.equal(canAccessPath('project_manager', '/team'), true);
  assert.equal(canAccessPath('project_manager', '/invoices'), false);

  console.log('OK — supervision department_supervisor');
}

main();
