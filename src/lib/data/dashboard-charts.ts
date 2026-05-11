import 'server-only';

import { addDays, endOfDay, format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AuthContext } from '@/lib/auth/permissions';
import { canViewGlobalFinanceStats } from '@/lib/auth/capabilities';
import {
  effectiveRole,
  fetchManagedClientIds,
  hasFullOrgDataAccess,
  shouldScopeTasksToAssignee,
} from '@/lib/auth/data-scope';
import {
  aggregateCriticalAlertsByType,
  fetchCriticalAlertsWithClient,
} from '@/lib/data/critical-alerts';
import { fetchTaskIdsAssignedToEmployee } from '@/lib/data/task-assignments';
import {
  fetchVideoIdsAssignedToEmployee,
  fetchVideoIdsForAssignmentRole,
} from '@/lib/data/video-assignments';
import {
  calendarMonthRange,
  expectedMonthlyRevenueFromClients,
  type ClientContractRow,
} from '@/lib/data/expected-monthly-revenue';
import type { DashboardScope } from '@/lib/data/dashboard-stats';
import { createAdminClient } from '@/lib/supabase/admin';
import { effectiveClientDeliveryIso } from '@/lib/videos/video-schedule';
import type { AgencyCurrencyIso } from '@/lib/money/format-money';
import type { InvoiceStatus } from '@/types/database';
import type { ClientPipelineRow, DashboardChartsPayload, DeadlineWeekDay, RevenueMonthPoint } from '@/types/dashboard-charts';

function localDayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  return format(d, 'yyyy-MM-dd');
}

function monthLabelFr(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), 'MMM yyyy', { locale: fr });
}

function lastNCalendarMonths(n: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ year: x.getFullYear(), month: x.getMonth() + 1 });
  }
  return out;
}

function invoiceResidualRow(inv: {
  id: string;
  status: InvoiceStatus;
  total: number;
  client_id: string;
}): number {
  if (inv.status === 'paid' || inv.status === 'cancelled' || inv.status === 'draft') return 0;
  const total = Number(inv.total);
  if (!Number.isFinite(total)) return 0;
  return Math.max(0, Math.round(total * 100) / 100);
}

export async function fetchDashboardChartsPayload(
  ctx: AuthContext,
  summary: { scope: DashboardScope; agencyDisplayCurrency: AgencyCurrencyIso },
): Promise<DashboardChartsPayload> {
  const currency = summary.agencyDisplayCurrency;
  if (!ctx.employee || !ctx.role) {
    return {
      currency,
      deadlinesWeek: null,
      revenueByMonth: null,
      criticalByType: null,
      clientPipeline: null,
    };
  }

  const supabase = createAdminClient();
  const eid = ctx.employee.id;
  const full = hasFullOrgDataAccess(ctx);
  const rk = effectiveRole(ctx.role);
  const scope = summary.scope;

  const showDeadlines =
    scope === 'full' ||
    scope === 'operations' ||
    scope === 'individual' ||
    scope === 'finance' ||
    scope === 'commercial';

  const showFinanceCharts =
    canViewGlobalFinanceStats(ctx.role) && (scope === 'full' || scope === 'finance');

  const showPipeline =
    (ctx.role === 'admin' || ctx.role === 'project_manager' || ctx.role === 'commercial') &&
    (scope === 'full' || scope === 'operations' || scope === 'commercial');

  const now = new Date();
  const weekStart = startOfDay(now);
  const weekEnd = endOfDay(addDays(weekStart, 6));
  const rangeStartIso = weekStart.toISOString();
  const rangeEndIso = weekEnd.toISOString();
  const weekDayKeys: { dayKey: string; labelShort: string }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(weekStart, i);
    weekDayKeys.push({
      dayKey: format(d, 'yyyy-MM-dd'),
      labelShort: format(d, 'EEE d MMM', { locale: fr }),
    });
  }
  const dayKeySet = new Set(weekDayKeys.map((x) => x.dayKey));

  const emptyBuckets = (): DeadlineWeekDay[] =>
    weekDayKeys.map((d) => ({
      ...d,
      tasks: 0,
      shoots: 0,
      deliveries: 0,
      invoices: 0,
      quoteFollowups: 0,
    }));

  const bump = (buckets: DeadlineWeekDay[], dayKey: string, field: keyof Omit<DeadlineWeekDay, 'dayKey' | 'labelShort'>) => {
    if (!dayKeySet.has(dayKey)) return;
    const row = buckets.find((b) => b.dayKey === dayKey);
    if (row) row[field] += 1;
  };

  let deadlinesWeek: DeadlineWeekDay[] | null = null;

  if (showDeadlines) {
    const buckets = emptyBuckets();
    const financeOnly = ctx.role === 'finance';
    const includeInvoices = canViewGlobalFinanceStats(ctx.role);
    const includeTasks = !financeOnly;
    const includeVideos = !financeOnly && rk !== 'seo' && rk !== 'developer';
    const includeQuotes = ctx.role === 'commercial';

    if (includeTasks) {
      const baseTask = () =>
        supabase
          .from('tasks')
          .select('id,deadline')
          .neq('status', 'done')
          .neq('status', 'archived')
          .not('deadline', 'is', null)
          .gte('deadline', rangeStartIso)
          .lte('deadline', rangeEndIso);

      let taskRows: { deadline?: string | null }[] = [];

      if (full) {
        const { data } = await baseTask();
        taskRows = data ?? [];
      } else if (ctx.role === 'commercial') {
        const pivot = await fetchTaskIdsAssignedToEmployee(supabase, eid);
        const parts = [`assignee_id.eq.${eid}`];
        if (pivot.length) parts.push(`id.in.(${pivot.join(',')})`);
        const { data } = await baseTask().or(parts.join(','));
        taskRows = data ?? [];
      } else if (shouldScopeTasksToAssignee(ctx) || ctx.role === 'cameraman') {
        const pivot = await fetchTaskIdsAssignedToEmployee(supabase, eid);
        const parts = [`assignee_id.eq.${eid}`];
        if (pivot.length) parts.push(`id.in.(${pivot.join(',')})`);
        const { data } = await baseTask().or(parts.join(','));
        taskRows = data ?? [];
      }

      for (const t of taskRows) {
        const dl = t.deadline;
        if (!dl) continue;
        bump(buckets, localDayKeyFromIso(dl), 'tasks');
      }
    }

    if (includeVideos) {
      const openEnded = supabase
        .from('videos')
        .select('id,shooting_date,client_delivery_at,delivery_deadline,status')
        .not('status', 'in', '(archived,cancelled)');

      if (full || ctx.role === 'project_manager') {
        const { data: vids } = await openEnded.limit(800);
        for (const raw of vids ?? []) {
          const v = raw as {
            shooting_date?: string | null;
            client_delivery_at?: string | null;
            delivery_deadline?: string | null;
          };
          const sd = v.shooting_date;
          if (sd) {
            const k = localDayKeyFromIso(sd);
            if (dayKeySet.has(k)) {
              const t = new Date(sd).getTime();
              if (t >= weekStart.getTime() && t <= weekEnd.getTime()) bump(buckets, k, 'shoots');
            }
          }
          const delIso = effectiveClientDeliveryIso({
            client_delivery_at: v.client_delivery_at ?? null,
            delivery_deadline: v.delivery_deadline ?? null,
          });
          if (delIso) {
            const k = localDayKeyFromIso(delIso);
            if (dayKeySet.has(k)) {
              const t = new Date(delIso).getTime();
              if (t >= weekStart.getTime() && t <= weekEnd.getTime()) bump(buckets, k, 'deliveries');
            }
          }
        }
      } else {
        const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, eid);
        const vaEd = await fetchVideoIdsForAssignmentRole(supabase, eid, 'editor');
        const vaCam = await fetchVideoIdsForAssignmentRole(supabase, eid, 'cameraman');
        const parts = [`editor_id.eq.${eid}`, `cameraman_id.eq.${eid}`];
        if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
        let q = supabase
          .from('videos')
          .select('id,shooting_date,client_delivery_at,delivery_deadline,status,editor_id,cameraman_id')
          .not('status', 'in', '(archived,cancelled)')
          .or(parts.join(','))
          .limit(400);
        const { data: vids } = await q;
        for (const raw of vids ?? []) {
          const v = raw as {
            id: string;
            shooting_date?: string | null;
            client_delivery_at?: string | null;
            delivery_deadline?: string | null;
            editor_id?: string | null;
            cameraman_id?: string | null;
          };
          const isCam = v.cameraman_id === eid || vaCam.includes(v.id);
          const isEd = v.editor_id === eid || vaEd.includes(v.id);

          const sd = v.shooting_date;
          if (sd && isCam) {
            const k = localDayKeyFromIso(sd);
            const t = new Date(sd).getTime();
            if (dayKeySet.has(k) && t >= weekStart.getTime() && t <= weekEnd.getTime()) bump(buckets, k, 'shoots');
          }
          const delIso = effectiveClientDeliveryIso({
            client_delivery_at: v.client_delivery_at ?? null,
            delivery_deadline: v.delivery_deadline ?? null,
          });
          if (delIso && isEd) {
            const k = localDayKeyFromIso(delIso);
            const t = new Date(delIso).getTime();
            if (dayKeySet.has(k) && t >= weekStart.getTime() && t <= weekEnd.getTime()) bump(buckets, k, 'deliveries');
          }
        }
      }
    }

    if (includeInvoices) {
      const { data: invs } = await supabase
        .from('invoices')
        .select('due_date,status')
        .in('status', ['sent', 'pending', 'overdue'])
        .gte('due_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('due_date', format(weekEnd, 'yyyy-MM-dd'));
      for (const inv of invs ?? []) {
        const due = (inv as { due_date: string }).due_date?.slice(0, 10);
        if (due && dayKeySet.has(due)) bump(buckets, due, 'invoices');
      }
    }

    if (includeQuotes) {
      const managed = await fetchManagedClientIds(supabase, eid);
      if (managed.length) {
        const { data: quotes } = await supabase
          .from('quotes')
          .select('valid_until,status,client_id')
          .eq('status', 'sent')
          .in('client_id', managed)
          .gte('valid_until', format(weekStart, 'yyyy-MM-dd'))
          .lte('valid_until', format(weekEnd, 'yyyy-MM-dd'));
        for (const q of quotes ?? []) {
          const vu = (q as { valid_until: string }).valid_until?.slice(0, 10);
          if (vu && dayKeySet.has(vu)) bump(buckets, vu, 'quoteFollowups');
        }
      }
    }

    deadlinesWeek = buckets;
  }

  let revenueByMonth: RevenueMonthPoint[] | null = null;
  if (showFinanceCharts) {
    const months = lastNCalendarMonths(6);
    const orGoals = months.map(({ year, month }) => `and(year.eq.${year},month.eq.${month})`).join(',');
    const { data: goalsRows } = await supabase.from('agency_monthly_goals').select('year,month,revenue_goal').or(orGoals);
    const goalMap = new Map<string, number | null>();
    for (const g of goalsRows ?? []) {
      const row = g as { year: number; month: number; revenue_goal: number | null };
      goalMap.set(`${row.year}-${row.month}`, row.revenue_goal == null ? null : Number(row.revenue_goal));
    }

    const { data: allClients } = await supabase
      .from('clients')
      .select('status, contract_type, monthly_fee, start_date, end_date');
    const clientRows = (allClients ?? []) as ClientContractRow[];

    const { data: allInvoices } = await supabase
      .from('invoices')
      .select('id,status,total,due_date,client_id,created_at');

    const invList = (allInvoices ?? []) as {
      id: string;
      status: InvoiceStatus;
      total: number;
      due_date: string;
      client_id: string;
    }[];

    const openInvIds = invList
      .filter((i) => i.status === 'sent' || i.status === 'pending' || i.status === 'overdue')
      .map((i) => i.id);

    const paidByInvoice = new Map<string, number>();
    if (openInvIds.length > 0) {
      const { data: payAlloc } = await supabase.from('payments').select('invoice_id, amount').in('invoice_id', openInvIds);
      for (const row of payAlloc ?? []) {
        const id = (row as { invoice_id: string }).invoice_id;
        paidByInvoice.set(id, (paidByInvoice.get(id) ?? 0) + Number((row as { amount: number }).amount));
      }
    }

    revenueByMonth = await Promise.all(
      months.map(async ({ year, month }) => {
        const { start: monthStart, end: monthEnd } = calendarMonthRange(year, month);
        const expectedRevenue = expectedMonthlyRevenueFromClients(clientRows, year, month);

        const { data: pays } = await supabase
          .from('payments')
          .select('amount')
          .gte('payment_date', monthStart)
          .lte('payment_date', monthEnd);
        const collected = (pays ?? []).reduce((s, p) => s + Number((p as { amount: number }).amount), 0);

        const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
        let pendingOpen = 0;
        if (isCurrent) {
          for (const inv of invList) {
            if (inv.status === 'paid' || inv.status === 'cancelled' || inv.status === 'draft') continue;
            const isPendingLike = inv.status === 'sent' || inv.status === 'pending';
            const isOverdueStatus = inv.status === 'overdue';
            if (!isPendingLike && !isOverdueStatus) continue;
            const residual = invoiceResidualRow(inv) - (paidByInvoice.get(inv.id) ?? 0);
            pendingOpen += Math.max(0, Math.round(residual * 100) / 100);
          }
          pendingOpen = Math.round(pendingOpen * 100) / 100;
        }

        const g = goalMap.get(`${year}-${month}`) ?? null;
        const revenueGoal = g != null && g > 0 ? g : g === 0 ? 0 : null;

        return {
          year,
          month,
          label: monthLabelFr(year, month),
          expectedRevenue: Math.round(expectedRevenue * 100) / 100,
          collected: Math.round(collected * 100) / 100,
          pendingOpen,
          revenueGoal,
        } satisfies RevenueMonthPoint;
      }),
    );
  }

  let criticalByType: DashboardChartsPayload['criticalByType'] = null;
  const criticalItems = await fetchCriticalAlertsWithClient(supabase, ctx);
  criticalByType = aggregateCriticalAlertsByType(criticalItems);

  let clientPipeline: ClientPipelineRow[] | null = null;
  if (showPipeline) {
    let clientFilter: string[] | null = null;
    if (ctx.role === 'commercial') {
      clientFilter = await fetchManagedClientIds(supabase, eid);
      if (clientFilter.length === 0) {
        clientPipeline = [
          { key: 'prospect', label: 'Prospects', count: 0 },
          { key: 'quote_sent', label: 'Devis envoyés', count: 0 },
          { key: 'quote_accepted', label: 'Devis acceptés', count: 0 },
          { key: 'active', label: 'Clients actifs', count: 0 },
          { key: 'pause', label: 'En pause', count: 0 },
          { key: 'terminated', label: 'Terminés', count: 0 },
        ];
      }
    }

    if (clientPipeline === null) {
      const inList = clientFilter && clientFilter.length ? clientFilter : null;

      let cq = supabase.from('clients').select('id,status', { count: 'exact', head: false });
      if (inList) cq = cq.in('id', inList);
      const { data: clients } = await cq;

      const rows = clients ?? [];
      const countStatus = (st: string) => rows.filter((r) => (r as { status: string }).status === st).length;

      let qqSent = supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('status', 'sent');
      let qqAcc = supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('status', 'accepted');
      if (inList) {
        qqSent = qqSent.in('client_id', inList);
        qqAcc = qqAcc.in('client_id', inList);
      }
      const [sentR, accR] = await Promise.all([qqSent, qqAcc]);

      clientPipeline = [
        { key: 'prospect', label: 'Prospects', count: countStatus('prospect') },
        { key: 'quote_sent', label: 'Devis envoyés', count: sentR.count ?? 0 },
        { key: 'quote_accepted', label: 'Devis acceptés', count: accR.count ?? 0 },
        { key: 'active', label: 'Clients actifs', count: countStatus('active') },
        { key: 'pause', label: 'En pause', count: countStatus('pause') },
        { key: 'terminated', label: 'Terminés', count: countStatus('terminated') },
      ];
    }
  }

  return {
    currency,
    deadlinesWeek,
    revenueByMonth,
    criticalByType,
    clientPipeline,
  };
}
