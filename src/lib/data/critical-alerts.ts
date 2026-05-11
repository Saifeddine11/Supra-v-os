import 'server-only';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServiceRoleClient } from '@/lib/supabase/admin';
import type { AuthContext } from '@/lib/auth/permissions';
import { canViewGlobalFinanceStats } from '@/lib/auth/capabilities';
import { effectiveRole, hasFullOrgDataAccess } from '@/lib/auth/data-scope';
import type { UserRole, VideoStatus } from '@/types/database';
import { effectiveClientDeliveryIso, isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';
import { getShootingScheduleState, isTodayCalendar, isTomorrowCalendar } from '@/lib/deadlines/deadline-state';
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

export type { CriticalActiveAlertDTO, CriticalActiveAlertsResponse };

export type CriticalAlertSeverity = 'critical' | 'warning';

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
  if (id.startsWith('vid-od-')) return { entityType: 'video', entityId: id.slice('vid-od-'.length) };
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

/** Répartition par libellé de type — alignée sur la bannière et `/api/notifications/critical-active`. */
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
  const alerts: CriticalActiveAlertDTO[] = items.map((item) => {
    const { entityType, entityId } = parseCriticalAlertEntity(item.id);
    return {
      id: item.id,
      entityType,
      entityId,
      severity: item.severity,
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

/**
 * Alertes visibles en haut du dashboard — respecte le périmètre du rôle (pas de finance globale hors droits).
 * `supabase` : passer **`createAdminClient()`** depuis routes/cron authentifiés : le périmètre est
 * appliqué ici (OR assignations, rôle finance, etc.). Un client session RLS masquait des lignes
 * déjà comptées par le dashboard.
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

  const push = (row: CriticalAlertItem) => {
    if (items.length >= 14) return;
    if (!items.some((x) => x.id === row.id)) items.push(row);
  };

  /** Tâches en retard (échéance passée, hors terminé / archivé). */
  async function pushOverdueTasksScoped() {
    let q = supabase
      .from('tasks')
      .select('id,title,deadline,clients:client_id(name,color_hex)')
      .neq('status', 'done')
      .neq('status', 'archived')
      .not('deadline', 'is', null)
      .lt('deadline', now.toISOString())
      .order('deadline', { ascending: true })
      .limit(8);

    if (!full && ctx.role !== 'commercial') {
      const pivot = await fetchTaskIdsAssignedToEmployee(supabase, eid);
      const parts = [`assignee_id.eq.${eid}`];
      if (pivot.length) parts.push(`id.in.(${pivot.join(',')})`);
      q = q.or(parts.join(','));
    } else if (ctx.role === 'commercial') {
      const parts = [`assignee_id.eq.${eid}`];
      const pivot = await fetchTaskIdsAssignedToEmployee(supabase, eid);
      if (pivot.length) parts.push(`id.in.(${pivot.join(',')})`);
      q = q.or(parts.join(','));
    }

    const { data } = await q;
    for (const t of data ?? []) {
      const cl = (t as { clients?: { name?: string; color_hex?: string | null } | null }).clients;
      const client = cl?.name;
      push({
        id: `task-od-${t.id}`,
        severity: 'critical',
        typeLabel: 'Tâche en retard',
        title: String((t as { title?: string }).title ?? 'Tâche'),
        detail: client ? `${client} · échéance dépassée` : 'Échéance dépassée',
        href: `${base}?highlight=${t.id}`,
        clientBrandHex: client ? getClientColor({ name: client, color_hex: cl?.color_hex ?? null }) : null,
      });
    }
  }

  /** Vidéos livraison en retard. */
  async function pushOverdueVideosScoped() {
    if (rk === 'finance') return;
    let q = supabase
      .from('videos')
      .select(
        'id,title,status,public_status,client_delivery_at,delivery_deadline,clients:client_id(name,color_hex)',
      )
      .not('status', 'in', '(archived,cancelled,published,validated)')
      .limit(40);

    if (!full && ctx.role !== 'commercial') {
      if (rk === 'editor' || rk === 'community_manager') {
        const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, eid);
        const parts = [`editor_id.eq.${eid}`, `cameraman_id.eq.${eid}`];
        if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
        q = q.or(parts.join(','));
      } else if (rk === 'cameraman') {
        const fromVa = await fetchVideoIdsForAssignmentRole(supabase, eid, 'cameraman');
        const parts = [`cameraman_id.eq.${eid}`];
        if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
        q = q.or(parts.join(','));
      } else if (effectiveRole(ctx.role) === 'developer' || rk === 'seo') {
        return;
      }
    }

    const { data } = await q;
    for (const v of data ?? []) {
      const row = v as {
        id: string;
        title: string;
        status: string;
        public_status?: string;
        client_delivery_at?: string | null;
        delivery_deadline?: string | null;
        clients?: { name?: string; color_hex?: string | null } | null;
      };
      if (
        !isVideoDeliveryOverdue({
          status: row.status,
          public_status: row.public_status ?? 'topic_proposed',
          client_delivery_at: row.client_delivery_at ?? null,
          delivery_deadline: row.delivery_deadline ?? null,
        })
      ) {
        continue;
      }
      const client = row.clients?.name;
      push({
        id: `vid-od-${row.id}`,
        severity: 'critical',
        typeLabel: 'Livraison vidéo',
        title: row.title,
        detail: client ? `${client} · livraison en retard` : 'Livraison en retard',
        href: '/videos',
        clientBrandHex: client
          ? getClientColor({ name: client, color_hex: row.clients?.color_hex ?? null })
          : null,
      });
    }
  }

  /** Tournages et livraisons aujourd’hui (aperçu). */
  async function pushTodayVideoDatesScoped() {
    if (rk === 'finance') return;
    let q = supabase
      .from('videos')
      .select(
        'id,title,shooting_date,client_delivery_at,delivery_deadline,status,clients:client_id(name,color_hex)',
      )
      .not('status', 'in', '(archived,cancelled)')
      .limit(60);

    if (!full && ctx.role !== 'commercial') {
      if (rk === 'editor' || rk === 'cameraman' || rk === 'community_manager') {
        const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, eid);
        const parts = [`editor_id.eq.${eid}`, `cameraman_id.eq.${eid}`];
        if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
        q = q.or(parts.join(','));
      } else return;
    }

    const { data } = await q;
    for (const raw of data ?? []) {
      const v = raw as {
        id: string;
        title: string;
        status: VideoStatus;
        shooting_date?: string | null;
        client_delivery_at?: string | null;
        delivery_deadline?: string | null;
        clients?: { name?: string; color_hex?: string | null } | null;
      };
      const client = v.clients?.name ?? '';
      const clientBrandHex = client
        ? getClientColor({ name: client, color_hex: v.clients?.color_hex ?? null })
        : null;
      if (v.shooting_date) {
        const shootState = getShootingScheduleState(v.shooting_date, v.status, now).state;
        if (shootState === 'overdue') {
          push({
            id: `vid-shoot-od-${v.id}`,
            severity: 'critical',
            typeLabel: 'Tournage dépassé',
            title: v.title,
            detail: client ? `${client} · date de tournage dépassée` : 'Date de tournage dépassée',
            href: '/videos',
            clientBrandHex,
          });
        } else if (shootState === 'today') {
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
      }
      const del = effectiveClientDeliveryIso({
        client_delivery_at: v.client_delivery_at ?? null,
        delivery_deadline: v.delivery_deadline ?? null,
      });
      if (del && isTodayCalendar(del, now)) {
        push({
          id: `vid-del-${v.id}`,
          severity: 'critical',
          typeLabel: 'Livraison aujourd’hui',
          title: v.title,
          detail: client ? `${client} · ${todayLabel}` : todayLabel,
          href: '/videos',
          clientBrandHex,
        });
      }
    }
  }

  /** Validations client (pipeline). */
  async function pushValidationsScoped() {
    if (!full && rk !== 'editor' && rk !== 'community_manager' && ctx.role !== 'project_manager') return;
    let q = supabase
      .from('videos')
      .select('id,title,clients:client_id(name,color_hex)')
      .or('status.eq.sent_to_client,public_status.eq.in_validation')
      .not('status', 'in', '(archived,cancelled)')
      .limit(8);

    if (!full && rk === 'editor') {
      const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, eid);
      const parts = [`editor_id.eq.${eid}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      q = q.or(parts.join(','));
    }

    const { data } = await q;
    for (const v of data ?? []) {
      const row = v as {
        id: string;
        title: string;
        clients?: { name?: string; color_hex?: string | null } | null;
      };
      const cn = row.clients?.name;
      push({
        id: `val-${row.id}`,
        severity: 'warning',
        typeLabel: 'Validation client',
        title: row.title,
        detail: cn ? `${cn} · attente retour` : 'Attente retour client',
        href: '/videos',
        clientBrandHex: cn ? getClientColor({ name: cn, color_hex: row.clients?.color_hex ?? null }) : null,
      });
    }
  }

  /** Finance : factures en retard (montants réservés aux rôles autorisés). */
  async function pushFinanceOverdue() {
    if (!canViewGlobalFinanceStats(ctx.role) && ctx.role !== 'finance') return;
    const { count } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'overdue');
    const n = count ?? 0;
    if (n > 0) {
      push({
        id: 'fin-inv-overdue',
        severity: 'critical',
        typeLabel: 'Facturation',
        title: `${n} facture(s) en retard`,
        detail: 'Relances et encaissements à traiter',
        href: '/invoices',
      });
    }
  }

  await pushOverdueTasksScoped();
  await pushOverdueVideosScoped();
  await pushTodayVideoDatesScoped();
  await pushValidationsScoped();
  await pushFinanceOverdue();

  /** Demain : tournage / livraison (rôles terrain & pilotage). */
  if (full || ctx.role === 'project_manager' || rk === 'cameraman' || rk === 'editor') {
    let q = supabase
      .from('videos')
      .select('id,title,shooting_date,client_delivery_at,delivery_deadline,clients:client_id(name,color_hex)')
      .not('status', 'in', '(archived,cancelled)')
      .limit(80);
    if (!full) {
      const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, eid);
      const parts = [`editor_id.eq.${eid}`, `cameraman_id.eq.${eid}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      q = q.or(parts.join(','));
    }
    const { data } = await q;
    for (const raw of data ?? []) {
      const v = raw as {
        id: string;
        title: string;
        shooting_date?: string | null;
        client_delivery_at?: string | null;
        delivery_deadline?: string | null;
        clients?: { name?: string; color_hex?: string | null } | null;
      };
      const client = v.clients?.name ?? '';
      const clientBrandHex = client
        ? getClientColor({ name: client, color_hex: v.clients?.color_hex ?? null })
        : null;
      if (v.shooting_date && isTomorrowCalendar(v.shooting_date, now) && (full || rk === 'cameraman' || rk === 'community_manager')) {
        push({
          id: `vid-shoot-tm-${v.id}`,
          severity: 'warning',
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
      if (del && isTomorrowCalendar(del, now) && (full || rk === 'editor' || rk === 'community_manager')) {
        push({
          id: `vid-del-tm-${v.id}`,
          severity: 'warning',
          typeLabel: 'Livraison demain',
          title: v.title,
          detail: client || 'Contrôler le livrable',
          href: '/videos',
          clientBrandHex,
        });
      }
    }
  }

  return items;
}

export async function fetchCriticalAlertsForDashboard(ctx: AuthContext): Promise<CriticalAlertItem[]> {
  return fetchCriticalAlertsWithClient(createAdminClient(), ctx);
}
