/**
 * Vérifications RBAC chef de projet — exécution : npx tsx scripts/test-capabilities-pm.ts
 */
import assert from 'node:assert/strict';
import type { UserRole } from '../src/types/database';
import {
  canArchiveTasks,
  canAssignTasks,
  canChangeTaskStatus,
  canCreateTasks,
  canDeleteInternalProject,
  canDeleteProject,
  canDeleteTask,
  canDeleteTasks,
  canDeleteVideo,
  canManageAllTasks,
  canManageClientPortal,
  canManagePayments,
  canManageProjects,
  canManageTasks,
  canModifyClients,
  canUpdateTasks,
  canViewAgencyGoals,
  canViewClientContractFinancials,
  canViewGlobalFinanceStats,
  canViewInvoices,
  canViewOperationalReports,
  canViewPayments,
  canViewProfitability,
  canViewQuotePipelineStats,
  canViewRevenue,
} from '../src/lib/auth/capabilities';

const PM: UserRole = 'project_manager';

function assertPm(role: UserRole, fn: (r: UserRole | null) => boolean, expected: boolean, label: string) {
  assert.equal(fn(role), expected, `${label} (${role})`);
}

function main() {
  // Opérationnel : true pour PM
  assertPm(PM, canManageAllTasks, true, 'canManageAllTasks');
  assertPm(PM, canManageTasks, true, 'canManageTasks');
  assertPm(PM, canCreateTasks, true, 'canCreateTasks');
  assertPm(PM, canUpdateTasks, true, 'canUpdateTasks');
  assertPm(PM, canDeleteTasks, true, 'canDeleteTasks');
  assertPm(PM, canDeleteTask, true, 'canDeleteTask');
  assertPm(PM, canArchiveTasks, true, 'canArchiveTasks');
  assertPm(PM, canAssignTasks, true, 'canAssignTasks');
  assertPm(PM, canChangeTaskStatus, true, 'canChangeTaskStatus');
  assertPm(PM, canDeleteVideo, true, 'canDeleteVideo');
  assertPm(PM, canModifyClients, true, 'canModifyClients');
  assertPm(PM, canManageProjects, true, 'canManageProjects');
  assertPm(PM, canDeleteProject, true, 'canDeleteProject');
  assertPm(PM, canDeleteInternalProject, true, 'canDeleteInternalProject');
  assertPm(PM, canManageClientPortal, true, 'canManageClientPortal');
  assertPm(PM, canViewOperationalReports, true, 'canViewOperationalReports');

  // Finance globale : false pour PM
  assertPm(PM, canViewGlobalFinanceStats, false, 'canViewGlobalFinanceStats');
  assertPm(PM, canViewInvoices, false, 'canViewInvoices');
  assertPm(PM, canViewPayments, false, 'canViewPayments');
  assertPm(PM, canManagePayments, false, 'canManagePayments');
  assertPm(PM, canViewClientContractFinancials, false, 'canViewClientContractFinancials');
  assertPm(PM, canViewAgencyGoals, false, 'canViewAgencyGoals');
  assertPm(PM, canViewRevenue, false, 'canViewRevenue');
  assertPm(PM, canViewProfitability, false, 'canViewProfitability');
  assertPm(PM, canViewQuotePipelineStats, false, 'canViewQuotePipelineStats');

  // Admin garde tout
  assertPm('admin', canViewGlobalFinanceStats, true, 'admin canViewGlobalFinanceStats');
  assertPm('admin', canManagePayments, true, 'admin canManagePayments');

  // Finance garde finance
  assertPm('finance', canViewGlobalFinanceStats, true, 'finance canViewGlobalFinanceStats');
  assertPm('finance', canManageAllTasks, false, 'finance canManageAllTasks');
  assertPm('finance', canCreateTasks, false, 'finance canCreateTasks');
  assertPm('commercial', canCreateTasks, false, 'commercial canCreateTasks');

  // Editor non impacté
  assertPm('editor', canManageAllTasks, false, 'editor canManageAllTasks');
  assertPm('editor', canViewGlobalFinanceStats, false, 'editor canViewGlobalFinanceStats');

  console.log('OK — capabilities project_manager');
}

main();
