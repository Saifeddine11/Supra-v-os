/**
 * SupAI capability flags — derived from existing RBAC (capabilities + data-scope).
 */
import 'server-only';

import type { AuthContext } from '@/lib/auth/permissions';
import type { UserRole } from '@/types/database';
import {
  canManageAllTasks,
  canManageVideos,
  canViewGlobalFinanceStats,
  canViewRevenue,
} from '@/lib/auth/capabilities';
import { hasFullOrgDataAccess, taskListingDenied } from '@/lib/auth/data-scope';
import { isStaff, navItemVisible } from '@/lib/auth/nav-policy';
import type { AiContextRequest } from '@/lib/ai/context-schema';
import type { QuickActionId } from '@/lib/ai/quick-action-prompts';
import {
  SUPAI_REFUSAL_GLOBAL_TEAM,
  SUPAI_REFUSAL_PERMISSION,
} from '@/lib/ai/supai-copy';
import { isExplicitGlobalCalendarRequest } from '@/lib/ai/calendar-intent';

export type SupaiPermissions = {
  canUseSupAI: boolean;
  canUseSupAIOperationalChat: boolean;
  /** Personal assigned work (all active internal staff). */
  canUseSupAIPersonalWork: boolean;
  canUseSupAIReadTasks: boolean;
  canUseSupAIReadVideos: boolean;
  canUseSupAIReadClients: boolean;
  canUseSupAICreateTaskDraft: boolean;
  canUseSupAIConfirmTaskCreation: boolean;
  canUseSupAICreateVideoDraft: boolean;
  canUseSupAIConfirmVideoCreation: boolean;
  canUseSupAIFinanceContext: boolean;
  canUseSupAIGlobalTeamContext: boolean;
  canUseSupAIDraftMessage: boolean;
  canUseSupAIUpdateTaskDraft: boolean;
  canUseSupAIConfirmTaskUpdate: boolean;
};

export function getSupaiPermissions(ctx: AuthContext): SupaiPermissions {
  const role = ctx.role;
  const active = Boolean(ctx.employee?.is_active && !ctx.employee?.archived_at);
  const staff = isStaff(role);
  const canUseSupAI = staff && active;

  const canReadTasks = canUseSupAI && !taskListingDenied(ctx);
  const canReadVideos = canUseSupAI && Boolean(role && navItemVisible('/videos', role));
  const canReadClients =
    canUseSupAI &&
    Boolean(
      role &&
        (hasFullOrgDataAccess(ctx) ||
          role === 'commercial' ||
          navItemVisible('/clients', role)),
    );

  /** SupAI create = pilotage opérationnel (admin / chef de projet), pas les rôles terrain. */
  const canCreateTask = canUseSupAI && Boolean(role && canManageAllTasks(role));
  const canCreateVideo =
    canUseSupAI &&
    Boolean(role && hasFullOrgDataAccess(ctx) && canManageVideos(role) && role !== 'finance');

  const canFinance =
    canUseSupAI && Boolean(role && (canViewGlobalFinanceStats(role) || canViewRevenue(role)));

  const canGlobalTeam = canUseSupAI && hasFullOrgDataAccess(ctx);
  const canUpdateTask =
    canUseSupAI && Boolean(role && canManageAllTasks(role));

  return {
    canUseSupAI,
    canUseSupAIOperationalChat: canUseSupAI,
    canUseSupAIPersonalWork: canUseSupAI,
    canUseSupAIReadTasks: canReadTasks,
    canUseSupAIReadVideos: canReadVideos,
    canUseSupAIReadClients: canReadClients,
    canUseSupAICreateTaskDraft: canCreateTask,
    canUseSupAIConfirmTaskCreation: canCreateTask,
    canUseSupAICreateVideoDraft: canCreateVideo,
    canUseSupAIConfirmVideoCreation: canCreateVideo,
    canUseSupAIFinanceContext: canFinance,
    canUseSupAIGlobalTeamContext: canGlobalTeam,
    canUseSupAIDraftMessage: canUseSupAI,
    canUseSupAIUpdateTaskDraft: canUpdateTask,
    canUseSupAIConfirmTaskUpdate: canUpdateTask,
  };
}

export function assertSupaiCapability(
  perms: SupaiPermissions,
  flag: keyof SupaiPermissions,
): string | null {
  if (!perms.canUseSupAI) {
    return 'SupAI est réservé à l’équipe interne.';
  }
  if (!perms[flag]) {
    return SUPAI_REFUSAL_PERMISSION;
  }
  return null;
}

export function canRunSupaiContextTool(
  request: AiContextRequest,
  perms: SupaiPermissions,
): { ok: true } | { ok: false; reason: string } {
  if (!perms.canUseSupAIOperationalChat) {
    return { ok: false, reason: SUPAI_REFUSAL_PERMISSION };
  }

  switch (request.type) {
    case 'searchTasks':
      if (!perms.canUseSupAIReadTasks) {
        return { ok: false, reason: SUPAI_REFUSAL_PERMISSION };
      }
      return { ok: true };
    case 'searchClients':
    case 'getClientSummary':
      if (!perms.canUseSupAIReadClients) {
        return { ok: false, reason: SUPAI_REFUSAL_PERMISSION };
      }
      return { ok: true };
    case 'searchVideos':
      if (!perms.canUseSupAIReadVideos) {
        return { ok: false, reason: SUPAI_REFUSAL_PERMISSION };
      }
      return { ok: true };
    case 'getTodayPriorities':
      return { ok: true };
    case 'getMyOperationalWork':
      if (!perms.canUseSupAIPersonalWork) {
        return { ok: false, reason: SUPAI_REFUSAL_PERMISSION };
      }
      return { ok: true };
    case 'getScopedCalendarWork':
      if (!perms.canUseSupAIOperationalChat) {
        return { ok: false, reason: SUPAI_REFUSAL_PERMISSION };
      }
      if (request.scopeMode === 'global' && !perms.canUseSupAIGlobalTeamContext) {
        return { ok: false, reason: SUPAI_REFUSAL_GLOBAL_TEAM };
      }
      return { ok: true };
    default:
      return { ok: false, reason: 'Outil non pris en charge.' };
  }
}

const GLOBAL_TEAM_PATTERNS = [
  /\btoutes?\s+les\s+t[âa]ches\s+(?:de\s+)?(?:l[''])?équipe\b/i,
  /\btoute\s+l['']équipe\b/i,
  /\bl['']équipe\s+(?:entière|complete|complète)\b/i,
  /\b(?:toutes?\s+les\s+)?vid[ée]os\s+(?:de\s+)?(?:l[''])?agence\b/i,
  /\bvue\s+globale\b/i,
  /\btous\s+les\s+(?:monteurs|cadreurs|employés|employes)\b/i,
  /\bcharge\s+(?:de\s+)?(?:toute\s+)?l['']équipe\b/i,
];

export function isGlobalTeamDataRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return GLOBAL_TEAM_PATTERNS.some((p) => p.test(text));
}

export function evaluateGlobalTeamGuardrail(
  message: string,
  perms: SupaiPermissions,
): string | null {
  if (
    (isGlobalTeamDataRequest(message) || isExplicitGlobalCalendarRequest(message)) &&
    !perms.canUseSupAIGlobalTeamContext
  ) {
    return SUPAI_REFUSAL_GLOBAL_TEAM;
  }
  return null;
}

export function getVisibleQuickActionIds(
  perms: SupaiPermissions,
  role: UserRole | null,
): QuickActionId[] {
  if (!perms.canUseSupAI || !role) return [];

  const withDraft = (ids: QuickActionId[]): QuickActionId[] =>
    perms.canUseSupAIDraftMessage && !ids.includes('draft_message')
      ? [...ids, 'draft_message']
      : ids;

  if (role === 'commercial') {
    const ids: QuickActionId[] = [];
    if (perms.canUseSupAIPersonalWork) ids.push('calendar_today', 'calendar_week', 'my_tasks');
    if (perms.canUseSupAIReadClients) ids.push('my_clients', 'client_followup');
    return withDraft(ids);
  }

  if (role === 'finance') {
    return withDraft(
      perms.canUseSupAIPersonalWork ? ['calendar_today', 'calendar_week', 'my_tasks'] : [],
    );
  }

  if (role === 'cameraman') {
    const ids: QuickActionId[] = [];
    if (perms.canUseSupAIPersonalWork) ids.push('calendar_today', 'calendar_week', 'my_tasks');
    if (perms.canUseSupAIReadVideos) ids.push('my_shootings', 'my_videos', 'calendar_shootings');
    if (perms.canUseSupAIOperationalChat) ids.push('priorities');
    return withDraft(ids);
  }

  if (role === 'editor' || role === 'community_manager') {
    const ids: QuickActionId[] = [];
    if (perms.canUseSupAIPersonalWork) ids.push('calendar_today', 'calendar_week', 'my_tasks');
    if (perms.canUseSupAIReadVideos) ids.push('my_videos', 'calendar_deliveries');
    if (perms.canUseSupAIOperationalChat) ids.push('priorities');
    return withDraft(ids);
  }

  if (
    role === 'designer' ||
    role === 'developer' ||
    role === 'seo'
  ) {
    const ids: QuickActionId[] = [];
    if (perms.canUseSupAIPersonalWork) ids.push('calendar_today', 'calendar_week', 'my_tasks');
    if (perms.canUseSupAIOperationalChat) ids.push('priorities');
    return withDraft(ids);
  }

  if (!perms.canUseSupAIGlobalTeamContext) {
    const ids: QuickActionId[] = [];
    if (perms.canUseSupAIPersonalWork) ids.push('calendar_today', 'calendar_week', 'my_tasks');
    if (perms.canUseSupAIReadVideos) ids.push('my_videos');
    if (perms.canUseSupAIOperationalChat) ids.push('priorities');
    return withDraft(ids);
  }

  const ids: QuickActionId[] = [];
  if (perms.canUseSupAIOperationalChat) {
    ids.push('calendar_today', 'calendar_week', 'calendar_month', 'priorities');
    if (perms.canUseSupAIReadTasks) ids.push('overdue_tasks');
    if (perms.canUseSupAIReadVideos) ids.push('calendar_shootings', 'calendar_deliveries');
  }
  if (perms.canUseSupAICreateTaskDraft) ids.push('create_task');
  if (perms.canUseSupAIUpdateTaskDraft) ids.push('update_task');
  if (perms.canUseSupAICreateVideoDraft) ids.push('create_video');
  if (perms.canUseSupAIReadClients) ids.push('search_client');
  if (perms.canUseSupAIReadVideos) ids.push('search_video');
  return withDraft(ids);
}
