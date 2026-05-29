import 'server-only';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServiceRoleClient } from '@/lib/supabase/admin';
import type { AuthContext } from '@/lib/auth/permissions';
import { canViewGlobalFinanceStats, canViewInvoices } from '@/lib/auth/capabilities';
import { effectiveRole, hasFullOrgDataAccess } from '@/lib/auth/data-scope';
import type { TaskStatus, UserRole, VideoStatus } from '@/types/database';
import { effectiveClientDeliveryIso } from '@/lib/videos/video-schedule';
import { isTodayCalendar, isTomorrowCalendar } from '@/lib/deadlines/deadline-state';
import { fetchTaskIdsAssignedToEmployee } from '@/lib/data/task-assignments';
import {
  fetchVideoIdsAssignedToEmployee,
  fetchVideoIdsForAssignmentRole,
} from '@/lib/data/video-assignments';
import { getClientColor } from '@/lib/ui/client-colors';
import type {
  CriticalActiveAlertDTO,
  CriticalActiveAlertsResponse,
} from '@/lib/notifications/critical-active-types';
import {
  isTaskOverdueForAlert,
  isActionRequiredNowAlertItem,
  TASK_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL,
  VIDEO_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL,
  isVideoActiveForAlerts,
  shouldShowClientValidationAlert,
  shouldShowShootingConfirmationAlert,
  shouldShowShootingScheduleOverdueAlert,
  shouldShowShootingExpectedEndOverdueAlert,
  shouldShowShootingInProgressInfoAlert,
  shouldShowVideoDeliveryOverdueAlert,
  shootingConfirmationSeverity,
  isInvoiceOverdueForAlert,
  type ActiveAlertSeverity,
} from '@/lib/alerts/active-alert-rules';

export type { CriticalActiveAlertDTO, CriticalActiveAlertsResponse };

export type CriticalAlertSeverity = ActiveAlertSeverity;

export interface CriticalAlertItem {
  id: string;
  severity: CriticalAlertSeverity;
  typeLabel: string;
  title: string;
  detail: string;
  href: string;
  clientBrandHex?: string | null;
}

function parseCriticalAlertEntity(id: string): { entityType: string; entityId: string } {
  if (id === 'fin-inv-overdue') return { entityType: 'invoices', entityId: 'overdue' };
  if (id.startsWith('task-od-')) return { entityType: 'task', entityId: id.slice('task-od-'.length) };
  if (id.startsWith('task-urg-')) return { entityType: 'task', entityId: id.slice('task-urg-'.length) };
  if (id.startsWith('vid-od-')) return { entityType: 'video', entityId: id.slice('vid-od-'.length) };
  if (id.startsWith('vid-shoot-conf-')) return { entityType: 'video', entityId: id.slice('vid-shoot-conf-'.length) };
  if (id.startsWith('vid-shoot-tm-')) return { entityType: 'video', entityId: id.slice('vid-shoot-tm-'.length) };
  if (id.startsWith('vid-shoot-od-')) return { entityType: 'video', entityId: id.slice('vid-shoot-od-'.length) };
  if (id.startsWith('vid-shoot-')) return { entityType: 'video', entityId: id.slice('vid-shoot-'.length) };
  if (id.startsWith('vid-del-tm-')) return { entityType: 'video', entityId: id.slice('vid-del-tm-'.length) };
  if (id.startsWith('vid-del-')) return { entityType: 'video', entityId: id.slice('vid-del-'.length) };
  if (id.startsWith('val-')) return { entityType: 'video', entityId: id.slice('val-'.length) };
  return { entityType: 'unknown', entityId: id };
}

export type CriticalAlertTypeBucket = {
  typeLabel: string;
  count: number;
  critical: number;
  warning: number;
};

export function aggregateCriticalAlertsByType(items: CriticalAlertItem[]): CriticalAlertTypeBucket[] {
  const map = new Map<string, { count: number; critical: number; warning: number }>();
  for (const item of items) {
    const cur = map.get(item.typeLabel) ?? { count: 0, critical: 0, warning: 0 };
    cur.count += 1;
    if (item.severity === 'critical') cur.critical += 1;
    else cur.warning += 1;
    map.set(item.typeLabel, cur);
  }
  return [...map.entries()]
    .map(([typeLabel, v]) => ({ typeLabel, ...v }))
    .sort((a, b) => b.count - a.count);
}

export function mapCriticalAlertsToActiveApi(items: CriticalAlertItem[]): CriticalActiveAlertsResponse {
  const actionItems = items.filter(isActionRequiredNowAlertItem);
  const alerts: CriticalActiveAlertDTO[] = actionItems.map((item) => {
    const { entityType, entityId } = parseCriticalAlertEntity(item.id);
    return {
      id: item.id,
      entityType,
      entityId,
      severity: item.severity === 'info' ? 'warning' : item.severity,
      title: item.typeLabel,
      message: `${item.title} — ${item.detail}`,
      href: item.href,
      dueAt: null,
    };
  });
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  return { alerts, criticalCount, warningCount };
}

function scopeRole(role: UserRole): UserRole {
  return role === 'designer' ? 'developer' : role;
}

const TASK_OPEN_FILTER = TASK_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL;
const VIDEO_ACTIVE_FILTER = VIDEO_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL;

/**
 * Alertes actives recalculées depuis l’état DB courant (pas is_read).
 */
export async function fetchCriticalAlertsWithClient(
  supabase: ServiceRoleClient,
  ctx: AuthContext,
): Promise<CriticalAlertItem[]> {
  if (!ctx.employee || !ctx.role) return [];

  const items: CriticalAlertItem[] = [];
  const now = new Date();
  const todayLabel = format(now, 'd MMM', { locale: fr });
  const base = '/tasks';
  const rk = scopeRole(ctx.role);
  const full = hasFullOrgDataAccess(ctx);
  const eid = ctx.employee.id;
  const canSeeFinance = canViewInvoices(ctx.role) && (canViewGlobalFinanceStats(ctx.role) || ctx.role === 'finance');
  const canSeeProductionAlerts = ctx.role !== 'finance';

  const push = (row: CriticalAlertItem) => {
    if (items.length >= 14) return;
    if (!items.some((x) => x.id === row.id)) items.push(row);
  };

  async function taskScopeOr(): Promise<string | null> {
    if (full) return null;
    if (ctx.role === 'commercial') {
      const pivot = await fetchTaskIdsAssignedToEmployee(supabase, eid);
      const parts = [`assignee_id.eq.${eid}`];
      if (pivot.length) parts.push(`id.in.(${pivot.join(',')})`);
      return parts.join(',');
    }
    if (rk === 'editor' || rk === 'cameraman' || rk === 'community_manager') {
      const pivot = await fetchTaskIdsAssignedToEmployee(supabase, eid);
      const parts = [`assignee_id.eq.${eid}`];
      if (pivot.length) parts.push(`id.in.(${pivot.join(',')})`);
      return parts.join(',');
    }
    if (rk === 'developer' || rk === 'seo') return null;
    return null;
  }

  async function videoScopeOr(): Promise<string | null> {
    if (full) return null;
    if (ctx.role === 'commercial') return null;
    if (rk === 'editor' || rk === 'community_manager') {
      const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, eid);
      const parts = [`editor_id.eq.${eid}`, `cameraman_id.eq.${eid}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      return parts.join(',');
    }
    if (rk === 'cameraman') {
      const fromVa = await fetchVideoIdsForAssignmentRole(supabase, eid, 'cameraman');
      const parts = [`cameraman_id.eq.${eid}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      return parts.join(',');
    }
    return null;
  }

  async function pushOverdueTasksScoped() {
    let q = supabase
      .from('tasks')
      .select('id,title,deadline,status,clients:client_id(name,color_hex)')
      .not('status', 'in', TASK_OPEN_FILTER)
      .not('deadline', 'is', null)
      .lt('deadline', now.toISOString())
      .order('deadline', { ascending: true })
      .limit(12);

    const scope = await taskScopeOr();
    if (scope === null && !full && ctx.role !== 'project_manager' && ctx.role !== 'admin') return;
    if (scope) q = q.or(scope);

    const { data } = await q;
    for (const t of data ?? []) {
      const row = t as {
        id: string;
        title?: string;
        deadline: string;
        status: TaskStatus;
        clients?: { name?: string; color_hex?: string | null } | null;
      };
      if (!isTaskOverdueForAlert({ status: row.status, deadline: row.deadline, now })) continue;

      const cl = row.clients;
      const client = cl?.name;
      push({
        id: `task-od-${row.id}`,
        severity: 'critical',
        typeLabel: 'Tâche en retard',
        title: String(row.title ?? 'Tâche'),
        detail: client ? `${client} · échéance dépassée` : 'Échéance dépassée',
        href: `${base}?highlight=${row.id}`,
        clientBrandHex: client ? getClientColor({ name: client, color_hex: cl?.color_hex ?? null }) : null,
      });
    }
  }

  async function pushOverdueVideosScoped() {
    if (!canSeeProductionAlerts) return;
    let q = supabase
      .from('videos')
      .select(
        'id,title,status,public_status,client_delivery_at,delivery_deadline,shooting_date,shooting_completed_at,clients:client_id(name,color_hex)',
      )
      .not('status', 'in', VIDEO_ACTIVE_FILTER)
      .limit(40);

    const scope = await videoScopeOr();
    if (scope === null && !full && ctx.role !== 'project_manager' && ctx.role !== 'admin') return;
    if (scope) q = q.or(scope);

    const { data } = await q;
    for (const v of data ?? []) {
      const row = v as {
        id: string;
        title: string;
        status: VideoStatus;
        public_status?: string;
        client_delivery_at?: string | null;
        delivery_deadline?: string | null;
        shooting_date?: string | null;
        shooting_completed_at?: string | null;
        clients?: { name?: string; color_hex?: string | null } | null;
      };
      if (!isVideoActiveForAlerts(row)) continue;
      if (
        !shouldShowVideoDeliveryOverdueAlert({
          status: row.status,
          public_status: row.public_status,
          client_delivery_at: row.client_delivery_at,
          delivery_deadline: row.delivery_deadline,
        })
      ) {
        continue;
      }
      const client = row.clients?.name;
      push({
        id: `vid-od-${row.id}`,
        severity: 'critical',
        typeLabel: 'Livraison en retard',
        title: row.title,
        detail: client ? `${client} · livraison dépassée` : 'Livraison dépassée',
        href: '/videos',
        clientBrandHex: client
          ? getClientColor({ name: client, color_hex: row.clients?.color_hex ?? null })
          : null,
      });
    }
  }

  async function pushTodayVideoDatesScoped() {
    if (!canSeeProductionAlerts) return;
    let q = supabase
      .from('videos')
      .select(
        'id,title,shooting_date,shooting_completed_at,shooting_expected_end_at,client_delivery_at,delivery_deadline,status,public_status,clients:client_id(name,color_hex)',
      )
      .not('status', 'in', VIDEO_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL)
      .limit(60);

    const scope = await videoScopeOr();
    if (scope === null && !full && ctx.role !== 'project_manager' && ctx.role !== 'admin') return;
    if (scope) q = q.or(scope);

    const { data } = await q;
    for (const raw of data ?? []) {
      const v = raw as {
        id: string;
        title: string;
        status: VideoStatus;
        public_status?: string;
        shooting_date?: string | null;
        shooting_completed_at?: string | null;
        shooting_expected_end_at?: string | null;
        client_delivery_at?: string | null;
        delivery_deadline?: string | null;
        clients?: { name?: string; color_hex?: string | null } | null;
      };
      if (!isVideoActiveForAlerts(v)) continue;

      const client = v.clients?.name ?? '';
      const clientBrandHex = client
        ? getClientColor({ name: client, color_hex: v.clients?.color_hex ?? null })
        : null;

      if (shouldShowShootingExpectedEndOverdueAlert(v, now)) {
        push({
          id: `vid-shoot-end-od-${v.id}`,
          severity: 'critical',
          typeLabel: 'Fin de tournage dépassée',
          title: v.title,
          detail: client
            ? `${client} · confirmer la fin ou reprogrammer`
            : 'Confirmer la fin ou reprogrammer',
          href: '/videos',
          clientBrandHex,
        });
      } else if (shouldShowShootingInProgressInfoAlert(v, now)) {
        push({
          id: `vid-shoot-ip-${v.id}`,
          severity: 'info',
          typeLabel: 'Tournage en cours',
          title: v.title,
          detail: client ? `${client} · en cours` : 'Tournage en cours',
          href: '/videos',
          clientBrandHex,
        });
      } else if (v.shooting_date && shouldShowShootingConfirmationAlert(v, now)) {
        push({
          id: `vid-shoot-conf-${v.id}`,
          severity: shootingConfirmationSeverity(v.shooting_date, now),
          typeLabel: 'Confirmation tournage',
          title: v.title,
          detail: client ? `${client} · confirmer le tournage` : 'Confirmer le tournage',
          href: '/videos',
          clientBrandHex,
        });
      } else if (v.shooting_date && shouldShowShootingScheduleOverdueAlert(v, now)) {
        push({
          id: `vid-shoot-od-${v.id}`,
          severity: 'critical',
          typeLabel: 'Tournage dépassé',
          title: v.title,
          detail: client ? `${client} · date dépassée` : 'Date de tournage dépassée',
          href: '/videos',
          clientBrandHex,
        });
      } else if (v.shooting_date && isTodayCalendar(v.shooting_date, now)) {
        push({
          id: `vid-shoot-${v.id}`,
          severity: 'warning',
          typeLabel: 'Tournage aujourd’hui',
          title: v.title,
          detail: client ? `${client} · ${todayLabel}` : todayLabel,
          href: '/videos',
          clientBrandHex,
        });
      }

      const del = effectiveClientDeliveryIso({
        client_delivery_at: v.client_delivery_at ?? null,
        delivery_deadline: v.delivery_deadline ?? null,
      });
      if (del && isTodayCalendar(del, now) && !shouldShowVideoDeliveryOverdueAlert(v)) {
        push({
          id: `vid-del-${v.id}`,
          severity: 'warning',
          typeLabel: 'Livraison aujourd’hui',
          title: v.title,
          detail: client ? `${client} · ${todayLabel}` : todayLabel,
          href: '/videos',
          clientBrandHex,
        });
      }
    }
  }

  async function pushValidationsScoped() {
    if (!canSeeProductionAlerts) return;
    if (!full && rk !== 'editor' && rk !== 'community_manager' && ctx.role !== 'project_manager') return;

    let q = supabase
      .from('videos')
      .select('id,title,status,public_status,clients:client_id(name,color_hex)')
      .not('status', 'in', VIDEO_ACTIVE_FILTER)
      .limit(20);

    const scope = await videoScopeOr();
    if (scope) q = q.or(scope);

    const { data } = await q;
    for (const v of data ?? []) {
      const row = v as {
        id: string;
        title: string;
        status: VideoStatus;
        public_status?: string;
        clients?: { name?: string; color_hex?: string | null } | null;
      };
      if (!shouldShowClientValidationAlert(row)) continue;
      const cn = row.clients?.name;
      push({
        id: `val-${row.id}`,
        severity: 'warning',
        typeLabel: 'Validation client',
        title: row.title,
        detail: cn ? `${cn} · retour attendu` : 'Retour client attendu',
        href: '/videos',
        clientBrandHex: cn ? getClientColor({ name: cn, color_hex: row.clients?.color_hex ?? null }) : null,
      });
    }
  }

  async function pushFinanceOverdue() {
    if (!canSeeFinance) return;
    const { data } = await supabase
      .from('invoices')
      .select('id,status,due_date')
      .in('status', ['overdue', 'sent', 'pending'])
      .limit(200);
    const n = (data ?? []).filter((inv) =>
      isInvoiceOverdueForAlert({
        status: inv.status as string,
        due_date: (inv as { due_date?: string }).due_date,
      }),
    ).length;
    if (n > 0) {
      push({
        id: 'fin-inv-overdue',
        severity: 'critical',
        typeLabel: 'Facturation',
        title: `${n} facture(s) à relancer`,
        detail: 'Encaissements à suivre',
        href: '/invoices',
      });
    }
  }

  await pushOverdueTasksScoped();
  await pushOverdueVideosScoped();
  await pushTodayVideoDatesScoped();
  await pushValidationsScoped();
  await pushFinanceOverdue();

  if (canSeeProductionAlerts && (full || ctx.role === 'project_manager' || rk === 'cameraman' || rk === 'editor')) {
    let q = supabase
      .from('videos')
      .select(
        'id,title,shooting_date,shooting_completed_at,client_delivery_at,delivery_deadline,status,public_status,clients:client_id(name,color_hex)',
      )
      .not('status', 'in', VIDEO_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL)
      .limit(80);
    const scope = await videoScopeOr();
    if (!scope && !full && ctx.role !== 'project_manager' && ctx.role !== 'admin') {
      // skip tomorrow block
    } else {
      if (scope) q = q.or(scope);
      const { data } = await q;
      for (const raw of data ?? []) {
        const v = raw as {
          id: string;
          title: string;
          shooting_date?: string | null;
          shooting_completed_at?: string | null;
          client_delivery_at?: string | null;
          delivery_deadline?: string | null;
          status: VideoStatus;
          public_status?: string;
          clients?: { name?: string; color_hex?: string | null } | null;
        };
        if (!isVideoActiveForAlerts(v)) continue;
        const client = v.clients?.name ?? '';
        const clientBrandHex = client
          ? getClientColor({ name: client, color_hex: v.clients?.color_hex ?? null })
          : null;
        if (
          v.shooting_date &&
          isTomorrowCalendar(v.shooting_date, now) &&
          (full || rk === 'cameraman' || rk === 'community_manager')
        ) {
          push({
            id: `vid-shoot-tm-${v.id}`,
            severity: 'info',
            typeLabel: 'Tournage demain',
            title: v.title,
            detail: client || 'Préparer le terrain',
            href: '/videos',
            clientBrandHex,
          });
        }
        const del = effectiveClientDeliveryIso({
          client_delivery_at: v.client_delivery_at ?? null,
          delivery_deadline: v.delivery_deadline ?? null,
        });
        if (
          del &&
          isTomorrowCalendar(del, now) &&
          (full || rk === 'editor' || rk === 'community_manager') &&
          !shouldShowVideoDeliveryOverdueAlert(v)
        ) {
          push({
            id: `vid-del-tm-${v.id}`,
            severity: 'info',
            typeLabel: 'Livraison demain',
            title: v.title,
            detail: client || 'Contrôler le livrable',
            href: '/videos',
            clientBrandHex,
          });
        }
      }
    }
  }

  return items;
}

export async function fetchCriticalAlertsForDashboard(ctx: AuthContext): Promise<CriticalAlertItem[]> {
  return fetchCriticalAlertsWithClient(createAdminClient(), ctx);
}
