import { createClient } from '@/lib/supabase/server';
import { canViewGlobalFinanceStats, canViewInvoices } from '@/lib/auth/capabilities';
import type { AuthContext } from '@/lib/auth/permissions';
import { resolveVisibleClientIds } from '@/lib/auth/data-scope';
import type { FinanceSnapshot } from '@/data/dashboard-mock';
import type { AgencyMonthlyGoalRow, InvoiceStatus, UserRole } from '@/types/database';
import { currentDashboardYearMonth } from '@/lib/data/agency-monthly-goals';
import { formatAgencyMoneyCompact, type AgencyCurrencyIso } from '@/lib/money/format-money';
import { getAgencyDisplayCurrency } from '@/lib/data/agency-settings-db';
import {
  calendarMonthRange,
  expectedMonthlyRevenueFromClients,
  type ClientContractRow,
} from '@/lib/data/expected-monthly-revenue';

export interface DashboardFinanceAgg {
  currency: AgencyCurrencyIso;
  /** CA prévu (contrats clients actifs, mois courant). */
  expectedMonthlyRevenue: number;
  /** Encaissé : somme des paiements enregistrés sur le mois. */
  collectedFromPayments: number;
  /** Reste à encaisser sur factures ouvertes (TTC − paiements). */
  outstandingAmount: number;
  unpaidCount: number;
  overdueCount: number;
  pendingCount: number;
  paidCount: number;
  acceptedQuotes: number;
  pendingQuotes: number;
}

export function zeroDashboardFinanceAgg(currency: AgencyCurrencyIso): DashboardFinanceAgg {
  return {
    currency,
    expectedMonthlyRevenue: 0,
    collectedFromPayments: 0,
    outstandingAmount: 0,
    unpaidCount: 0,
    overdueCount: 0,
    pendingCount: 0,
    paidCount: 0,
    acceptedQuotes: 0,
    pendingQuotes: 0,
  };
}

export type DashboardScope = 'full' | 'operations' | 'finance' | 'commercial' | 'individual';

export interface PersonalWorkload {
  myOpenTasks: number;
  myOverdueTasks: number;
  myUrgentTasks: number;
  myTasksDueToday: number;
  myBlockedTasks: number;
  myVideosAsEditor: number;
  myVideosAsCameraman: number;
  myShootsPlanned: number;
  myVideosInRevision: number;
  myClientValidations: number;
  myProjectsActive: number;
  myReportsToSend: number;
}

export interface CommercialKpis {
  myActiveClients: number;
  myProspects: number;
  quotesSent: number;
  quotesAccepted: number;
  quotesRefused: number;
  quotesExpiring: number;
  quotesPending: number;
}

export interface DashboardSummary {
  scope: DashboardScope;
  activeClients: number;
  openTasks: number;
  overdueTasks: number;
  urgentTasks: number;
  pendingInvoices: number | null;
  activeVideos: number;
  videosPublishedThisMonth: number;
  projectsInProgress: number;
  clientValidationsPending: number;
  finance: DashboardFinanceAgg | null;
  personal: PersonalWorkload;
  commercial: CommercialKpis | null;
  /** Ligne objectifs du mois calendaire courant, si elle existe. */
  agencyMonthlyGoal: AgencyMonthlyGoalRow | null;
  /** Devise d’affichage globale (Paramètres agence). */
  agencyDisplayCurrency: AgencyCurrencyIso;
}

function emptyPersonal(): PersonalWorkload {
  return {
    myOpenTasks: 0,
    myOverdueTasks: 0,
    myUrgentTasks: 0,
    myTasksDueToday: 0,
    myBlockedTasks: 0,
    myVideosAsEditor: 0,
    myVideosAsCameraman: 0,
    myShootsPlanned: 0,
    myVideosInRevision: 0,
    myClientValidations: 0,
    myProjectsActive: 0,
    myReportsToSend: 0,
  };
}

function scopeKey(role: UserRole): UserRole {
  return role === 'designer' ? 'developer' : role;
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function todayBoundsIso(): { start: string; end: string; day: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString(), day: start.toISOString().slice(0, 10) };
}

/** Données finance pour la section « Finance » — uniquement chiffres réels. */
export function financeSnapshotFromAgg(
  agg: DashboardFinanceAgg | null,
  goal: AgencyMonthlyGoalRow | null,
  currencyFallback: AgencyCurrencyIso
): FinanceSnapshot {
  const a = agg ?? zeroDashboardFinanceAgg(currencyFallback);
  const c = a.currency;

  let monthlyTarget: string;
  let targetDetail: string | null = null;
  let targetProgressPercent: number | null = null;

  if (!goal) {
    monthlyTarget = 'Non défini';
    targetDetail = 'Aucune ligne pour ce mois dans Paramètres.';
  } else if (goal.revenue_goal <= 0) {
    monthlyTarget = formatAgencyMoneyCompact(0, c);
    targetDetail = 'Objectif chiffre d’affaires à renseigner (montant > 0).';
  } else {
    monthlyTarget = formatAgencyMoneyCompact(goal.revenue_goal, c);
    const pct = Math.round((a.collectedFromPayments / goal.revenue_goal) * 100);
    targetProgressPercent = Math.min(100, Math.max(0, pct));
    targetDetail = `${targetProgressPercent} % de l’objectif (encaissé / objectif)`;
  }

  return {
    monthlyRevenue: formatAgencyMoneyCompact(a.expectedMonthlyRevenue, c),
    monthlyTarget,
    collected: formatAgencyMoneyCompact(a.collectedFromPayments, c),
    pending: formatAgencyMoneyCompact(a.outstandingAmount, c),
    unpaidInvoicesCount: a.unpaidCount,
    paidInvoicesCount: a.paidCount,
    pendingInvoicesCount: a.pendingCount,
    overdueInvoicesCount: a.overdueCount,
    acceptedQuotes: a.acceptedQuotes,
    pendingQuotes: a.pendingQuotes,
    targetDetail,
    targetProgressPercent,
  };
}

async function fetchFinanceBlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: AuthContext,
  today: string,
  agencyDisplayCurrency: AgencyCurrencyIso
): Promise<{ pendingInvoices: number | null; finance: DashboardFinanceAgg | null }> {
  const role = ctx.role;
  if (!role || !ctx.employee) {
    return { pendingInvoices: null, finance: null };
  }

  const allowGlobal = canViewGlobalFinanceStats(role);
  const allowCommercialScoped = role === 'commercial' && canViewInvoices(role);
  if (!allowGlobal && !allowCommercialScoped) {
    return { pendingInvoices: null, finance: null };
  }

  const scope = await resolveVisibleClientIds(supabase, ctx);
  if (scope !== 'all' && scope.length === 0) {
    return { pendingInvoices: 0, finance: zeroDashboardFinanceAgg(agencyDisplayCurrency) };
  }

  const clientFilter = scope === 'all' ? null : scope;
  const { year, month } = currentDashboardYearMonth();
  const { start: monthStart, end: monthEnd } = calendarMonthRange(year, month);

  let clientsQ = supabase
    .from('clients')
    .select('status, contract_type, monthly_fee, start_date, end_date');
  if (clientFilter) clientsQ = clientsQ.in('id', clientFilter);

  let paymentsMonthQ = supabase
    .from('payments')
    .select('amount, payment_date, invoice_id, client_id')
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd);
  if (clientFilter) paymentsMonthQ = paymentsMonthQ.in('client_id', clientFilter);

  let invQ = supabase.from('invoices').select('id,status,total,due_date,client_id');
  if (clientFilter) invQ = invQ.in('client_id', clientFilter);

  let quotesAccQ = supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('status', 'accepted');
  if (clientFilter) quotesAccQ = quotesAccQ.in('client_id', clientFilter);

  let quotesPendQ = supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .in('status', ['draft', 'sent']);
  if (clientFilter) quotesPendQ = quotesPendQ.in('client_id', clientFilter);

  const [clientsR, paymentsR, invR, quotesAccR, quotesPendR] = await Promise.all([
    clientsQ,
    paymentsMonthQ,
    invQ,
    quotesAccQ,
    quotesPendQ,
  ]);

  const expected = expectedMonthlyRevenueFromClients(
    (clientsR.data ?? []) as ClientContractRow[],
    year,
    month
  );

  const collectedFromPayments = (paymentsR.data ?? []).reduce(
    (s, p) => s + Number((p as { amount: number }).amount),
    0
  );

  const invRows = (invR.data ?? []) as {
    id: string;
    status: InvoiceStatus;
    total: number;
    due_date: string;
    client_id: string;
  }[];

  const openInvIds = invRows
    .filter((i) => i.status === 'sent' || i.status === 'pending' || i.status === 'overdue')
    .map((i) => i.id);

  const paidByInvoice = new Map<string, number>();
  if (openInvIds.length > 0) {
    let payAllocQ = supabase.from('payments').select('invoice_id, amount').in('invoice_id', openInvIds);
    if (clientFilter) payAllocQ = payAllocQ.in('client_id', clientFilter);
    const { data: payAlloc } = await payAllocQ;
    for (const row of payAlloc ?? []) {
      const id = (row as { invoice_id: string }).invoice_id;
      paidByInvoice.set(id, (paidByInvoice.get(id) ?? 0) + Number((row as { amount: number }).amount));
    }
  }

  let outstandingAmount = 0;
  let unpaidCount = 0;
  let overdueCount = 0;
  let pendingCount = 0;
  let paidCount = 0;

  for (const inv of invRows) {
    if (inv.status === 'paid') {
      paidCount += 1;
      continue;
    }
    if (inv.status === 'cancelled' || inv.status === 'draft') continue;

    const total = Number(inv.total);
    const paid = paidByInvoice.get(inv.id) ?? 0;
    const residual = Math.max(0, Math.round((total - paid) * 100) / 100);

    const isPendingLike = inv.status === 'sent' || inv.status === 'pending';
    const isOverdueStatus = inv.status === 'overdue';
    const dueOverdue = inv.due_date < today && isPendingLike;

    if (isPendingLike) pendingCount += 1;
    if (isPendingLike || isOverdueStatus) {
      unpaidCount += 1;
      outstandingAmount += residual;
    }
    if (isOverdueStatus || dueOverdue) overdueCount += 1;
  }

  outstandingAmount = Math.round(outstandingAmount * 100) / 100;

  const pendOnly = invRows.filter((i) => i.status === 'sent' || i.status === 'pending').length;

  const finance: DashboardFinanceAgg = {
    currency: agencyDisplayCurrency,
    expectedMonthlyRevenue: expected,
    collectedFromPayments: Math.round(collectedFromPayments * 100) / 100,
    outstandingAmount,
    unpaidCount,
    overdueCount,
    pendingCount,
    paidCount,
    acceptedQuotes: quotesAccR.count ?? 0,
    pendingQuotes: quotesPendR.count ?? 0,
  };

  return { pendingInvoices: pendOnly, finance };
}

async function fetchAgencyAggregates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  now: string,
  monthStart: string
) {
  const tasksOpenQ = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'done')
    .neq('status', 'archived');

  const tasksOverdueQ = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'done')
    .neq('status', 'archived')
    .lt('deadline', now);

  const tasksUrgentQ = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('priority', 'urgent')
    .neq('status', 'done')
    .neq('status', 'archived');

  const vidQ = supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'published')
    .neq('status', 'archived')
    .neq('status', 'cancelled');

  const vidPublishedMonthQ = supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('updated_at', monthStart);

  const clientsQ = supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  const projectsQ = supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .in('status', ['in_progress', 'waiting_client', 'waiting_content', 'review']);

  const validationsQ = supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .or('public_status.eq.in_validation,status.eq.sent_to_client');

  const [
    clientsR,
    tasksOpenR,
    tasksOverdueR,
    tasksUrgentR,
    vidR,
    vidPubR,
    projectsR,
    validationsR,
  ] = await Promise.all([
    clientsQ,
    tasksOpenQ,
    tasksOverdueQ,
    tasksUrgentQ,
    vidQ,
    vidPublishedMonthQ,
    projectsQ,
    validationsQ,
  ]);

  return {
    activeClients: clientsR.count ?? 0,
    openTasks: tasksOpenR.count ?? 0,
    overdueTasks: tasksOverdueR.count ?? 0,
    urgentTasks: tasksUrgentR.count ?? 0,
    activeVideos: vidR.count ?? 0,
    videosPublishedThisMonth: vidPubR.count ?? 0,
    projectsInProgress: projectsR.count ?? 0,
    clientValidationsPending: validationsR.count ?? 0,
  };
}

async function fetchPersonalWorkload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string,
  userId: string,
  role: UserRole
): Promise<PersonalWorkload> {
  const r = scopeKey(role);
  const now = new Date().toISOString();
  const { start, end } = todayBoundsIso();

  const baseTask = () =>
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', employeeId)
      .neq('status', 'done')
      .neq('status', 'archived');

  const myOpenQ = baseTask();
  const myOverdueQ = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assignee_id', employeeId)
    .neq('status', 'done')
    .neq('status', 'archived')
    .lt('deadline', now);

  const myUrgentQ = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assignee_id', employeeId)
    .eq('priority', 'urgent')
    .neq('status', 'done')
    .neq('status', 'archived');

  const myDueTodayQ = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assignee_id', employeeId)
    .neq('status', 'done')
    .neq('status', 'archived')
    .gte('deadline', start)
    .lte('deadline', end);

  const myBlockedQ = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assignee_id', employeeId)
    .eq('status', 'blocked');

  const myVideosEditorQ = supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('editor_id', employeeId)
    .neq('status', 'published')
    .neq('status', 'archived')
    .neq('status', 'cancelled');

  const myVideosCamQ = supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('cameraman_id', employeeId)
    .neq('status', 'published')
    .neq('status', 'archived')
    .neq('status', 'cancelled');

  const myShootsQ = supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('cameraman_id', employeeId)
    .eq('status', 'shooting_planned');

  const myRevisionQ = supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('editor_id', employeeId)
    .eq('status', 'client_revision');

  const myValQ = supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('editor_id', employeeId)
    .or('public_status.eq.in_validation,status.eq.sent_to_client');

  const activeProjectStatuses = ['in_progress', 'waiting_client', 'waiting_content', 'review'] as const;

  const myProjectsQ = supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .or(`lead_id.eq.${employeeId},team_ids.cs.{${employeeId}}`)
    .in('status', [...activeProjectStatuses]);

  let reportsQ = supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .is('sent_at', null)
    .eq('created_by', userId);

  if (r === 'seo') {
    reportsQ = reportsQ.eq('type', 'seo');
  }

  const [
    openR,
    overdueR,
    urgentR,
    dueTodayR,
    blockedR,
    edR,
    camR,
    shootR,
    revR,
    valR,
    projR,
    reportsR,
  ] = await Promise.all([
    myOpenQ,
    myOverdueQ,
    myUrgentQ,
    myDueTodayQ,
    myBlockedQ,
    myVideosEditorQ,
    myVideosCamQ,
    myShootsQ,
    myRevisionQ,
    myValQ,
    myProjectsQ,
    reportsQ,
  ]);

  const myProjectsActive = projR.count ?? 0;

  return {
    myOpenTasks: openR.count ?? 0,
    myOverdueTasks: overdueR.count ?? 0,
    myUrgentTasks: urgentR.count ?? 0,
    myTasksDueToday: dueTodayR.count ?? 0,
    myBlockedTasks: blockedR.count ?? 0,
    myVideosAsEditor: edR.count ?? 0,
    myVideosAsCameraman: camR.count ?? 0,
    myShootsPlanned: shootR.count ?? 0,
    myVideosInRevision: revR.count ?? 0,
    myClientValidations: valR.count ?? 0,
    myProjectsActive,
    myReportsToSend: reportsR.count ?? 0,
  };
}

async function fetchCommercialKpis(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string,
  today: string
): Promise<CommercialKpis> {
  const { data: rows, error } = await supabase
    .from('clients')
    .select('id, status')
    .eq('account_manager_id', employeeId);

  if (error || !rows?.length) {
    return {
      myActiveClients: 0,
      myProspects: 0,
      quotesSent: 0,
      quotesAccepted: 0,
      quotesRefused: 0,
      quotesExpiring: 0,
      quotesPending: 0,
    };
  }

  const myActiveClients = rows.filter((c) => c.status === 'active').length;
  const myProspects = rows.filter((c) => c.status === 'prospect').length;
  const ids = rows.map((c) => c.id);

  const exp = new Date(today);
  exp.setDate(exp.getDate() + 7);
  const expUntil = exp.toISOString().slice(0, 10);

  const [sentR, accR, refR, expR, pendR] = await Promise.all([
    supabase.from('quotes').select('id', { count: 'exact', head: true }).in('client_id', ids).eq('status', 'sent'),
    supabase.from('quotes').select('id', { count: 'exact', head: true }).in('client_id', ids).eq('status', 'accepted'),
    supabase.from('quotes').select('id', { count: 'exact', head: true }).in('client_id', ids).eq('status', 'refused'),
    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .in('client_id', ids)
      .eq('status', 'sent')
      .gte('valid_until', today)
      .lte('valid_until', expUntil),
    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .in('client_id', ids)
      .in('status', ['draft', 'sent']),
  ]);

  return {
    myActiveClients,
    myProspects,
    quotesSent: sentR.count ?? 0,
    quotesAccepted: accR.count ?? 0,
    quotesRefused: refR.count ?? 0,
    quotesExpiring: expR.count ?? 0,
    quotesPending: pendR.count ?? 0,
  };
}

/**
 * Résumé dashboard selon le rôle : agrégats agence, périmètre commercial ou charges personnelles.
 */
export async function getDashboardSummary(ctx: AuthContext): Promise<DashboardSummary> {
  const agencyDisplayCurrency = await getAgencyDisplayCurrency();

  const empty: DashboardSummary = {
    scope: 'individual',
    activeClients: 0,
    openTasks: 0,
    overdueTasks: 0,
    urgentTasks: 0,
    pendingInvoices: null,
    activeVideos: 0,
    videosPublishedThisMonth: 0,
    projectsInProgress: 0,
    clientValidationsPending: 0,
    finance: null,
    personal: emptyPersonal(),
    commercial: null,
    agencyMonthlyGoal: null,
    agencyDisplayCurrency,
  };

  if (!ctx.employee || !ctx.role) {
    return empty;
  }

  const supabase = await createClient();
  const role = ctx.role;
  const rk = scopeKey(role);
  const empId = ctx.employee.id;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const monthStart = startOfMonthIso();
  const { year: goalYear, month: goalMonth } = currentDashboardYearMonth();

  const goalPromise = supabase
    .from('agency_monthly_goals')
    .select('*')
    .eq('year', goalYear)
    .eq('month', goalMonth)
    .maybeSingle();

  const personal = await fetchPersonalWorkload(supabase, empId, ctx.userId, role);

  if (role === 'project_manager') {
    const agency = await fetchAgencyAggregates(supabase, now, monthStart);
    return {
      scope: 'operations',
      ...agency,
      pendingInvoices: null,
      finance: null,
      personal,
      commercial: null,
      agencyMonthlyGoal: null,
      agencyDisplayCurrency,
    };
  }

  if (role === 'admin') {
    const [agency, fin, _p, goalRes] = await Promise.all([
      fetchAgencyAggregates(supabase, now, monthStart),
      fetchFinanceBlock(supabase, ctx, today, agencyDisplayCurrency),
      Promise.resolve(personal),
      goalPromise,
    ]);
    const agencyMonthlyGoal = (goalRes.data as AgencyMonthlyGoalRow | null) ?? null;
    return {
      scope: 'full',
      ...agency,
      pendingInvoices: fin.pendingInvoices,
      finance: fin.finance,
      personal,
      commercial: null,
      agencyMonthlyGoal,
      agencyDisplayCurrency,
    };
  }

  if (role === 'finance') {
    const [fin, goalRes] = await Promise.all([
      fetchFinanceBlock(supabase, ctx, today, agencyDisplayCurrency),
      goalPromise,
    ]);
    const agencyMonthlyGoal = (goalRes.data as AgencyMonthlyGoalRow | null) ?? null;
    return {
      scope: 'finance',
      activeClients: 0,
      openTasks: 0,
      overdueTasks: 0,
      urgentTasks: 0,
      pendingInvoices: fin.pendingInvoices,
      activeVideos: 0,
      videosPublishedThisMonth: 0,
      projectsInProgress: 0,
      clientValidationsPending: 0,
      finance: fin.finance,
      personal,
      commercial: null,
      agencyMonthlyGoal,
      agencyDisplayCurrency,
    };
  }

  if (role === 'commercial') {
    const [commercial, fin, goalRes] = await Promise.all([
      fetchCommercialKpis(supabase, empId, today),
      fetchFinanceBlock(supabase, ctx, today, agencyDisplayCurrency),
      goalPromise,
    ]);
    const agencyMonthlyGoal = (goalRes.data as AgencyMonthlyGoalRow | null) ?? null;
    return {
      scope: 'commercial',
      activeClients: commercial.myActiveClients,
      openTasks: personal.myOpenTasks,
      overdueTasks: personal.myOverdueTasks,
      urgentTasks: personal.myUrgentTasks,
      pendingInvoices: fin.pendingInvoices,
      activeVideos: 0,
      videosPublishedThisMonth: 0,
      projectsInProgress: 0,
      clientValidationsPending: 0,
      finance: fin.finance,
      personal,
      commercial,
      agencyMonthlyGoal,
      agencyDisplayCurrency,
    };
  }

  if (
    rk === 'editor' ||
    rk === 'cameraman' ||
    rk === 'developer' ||
    rk === 'seo' ||
    rk === 'community_manager'
  ) {
    const [fin, goalRes] = await Promise.all([
      canViewInvoices(role)
        ? fetchFinanceBlock(supabase, ctx, today, agencyDisplayCurrency)
        : Promise.resolve({ pendingInvoices: null, finance: null }),
      goalPromise,
    ]);
    const myVids =
      rk === 'editor'
        ? personal.myVideosAsEditor
        : rk === 'cameraman'
          ? personal.myVideosAsCameraman
          : personal.myVideosAsEditor + personal.myVideosAsCameraman;

    const agencyMonthlyGoal = (goalRes.data as AgencyMonthlyGoalRow | null) ?? null;
    return {
      scope: 'individual',
      activeClients: 0,
      openTasks: personal.myOpenTasks,
      overdueTasks: personal.myOverdueTasks,
      urgentTasks: personal.myUrgentTasks,
      pendingInvoices: fin.pendingInvoices,
      activeVideos: myVids,
      videosPublishedThisMonth: 0,
      projectsInProgress: personal.myProjectsActive,
      clientValidationsPending: personal.myClientValidations,
      finance: fin.finance,
      personal,
      commercial: null,
      agencyMonthlyGoal,
      agencyDisplayCurrency,
    };
  }

  const { data: goalFallback } = await goalPromise;
  return {
    ...empty,
    personal,
    agencyMonthlyGoal: (goalFallback as AgencyMonthlyGoalRow | null) ?? null,
    agencyDisplayCurrency,
  };
}
