import 'server-only';

import {
  addDays,
  endOfWeek,
  format,
  formatDistanceToNow,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { canViewGlobalFinanceStats } from '@/lib/auth/capabilities';
import {
  isInvoiceOverdueForAlert,
  isTaskActiveForCriticalAlerts,
  isTaskOverdueForAlert,
  isTaskUrgentForAlert,
  TASK_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL,
} from '@/lib/alerts/active-alert-rules';
import { effectiveClientDeliveryIso, isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';
import {
  calendarMonthRange,
  expectedMonthlyRevenueFromClients,
  type ClientContractRow,
} from '@/lib/data/expected-monthly-revenue';
import { currentDashboardYearMonth } from '@/lib/data/agency-monthly-goals';
import { getAgencyDisplayCurrency } from '@/lib/data/agency-settings-db';
import { listDashboardActivityForVariant } from '@/lib/data/activity-logs';
import { formatActivityLogSummaryLine } from '@/lib/data/activity-log-display';
import { hrefTasksOpenDetail } from '@/lib/tasks/task-deep-link';
import { hrefVideosOpenDetailKanban } from '@/lib/videos/video-deep-link';
import { withDevTime } from '@/lib/perf/dev-time';
import {
  dayKey,
  enumerateDays,
  formatPeriodAxisLabel,
  inDayRange,
  percentChange,
  resolveCockpitPeriod,
  type CockpitPeriodKey,
  type CockpitPeriodRange,
} from '@/lib/dashboard/period';
import {
  DEFAULT_ESTIMATED_TASK_HOURS,
  deriveWorkload,
  invoiceResidual as invoiceResidualAmount,
  projectHealth,
} from '@/lib/dashboard/cockpit-rules';
import type {
  AdminCockpitPayload,
  CockpitActionItem,
  CockpitActivityItem,
  CockpitAgencyHealth,
  CockpitClientRevenue,
  CockpitDeadlineItem,
  CockpitHealthLevel,
  CockpitHeatmapRow,
  CockpitPriorityTone,
  CockpitProjectHealth,
  CockpitProjectRow,
  CockpitRevenuePoint,
  CockpitTeamMember,
  CockpitWorkloadState,
} from '@/types/dashboard-cockpit';
import type {
  InvoiceStatus,
  ProjectStatus,
  TaskDepartment,
  TaskPriority,
  TaskStatus,
  UserRole,
  VideoStatus,
} from '@/types/database';
import { PROJECT_STATUS_MAP, ROLE_LABELS } from '@/types/domain';

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  'todo',
  'in_progress',
  'waiting_client',
  'waiting_content',
  'review',
];
const OPEN_TASK_STATUSES: TaskStatus[] = [
  'todo',
  'in_progress',
  'waiting_client',
  'waiting_team',
  'review',
  'blocked',
];
const IN_PROGRESS_TASK_STATUSES: TaskStatus[] = ['in_progress', 'waiting_team', 'review'];
const HEALTH_SCORE: Record<CockpitHealthLevel, number> = { good: 100, attention: 62, critical: 28 };

type EmpRow = {
  id: string;
  full_name: string;
  role: UserRole;
  weekly_capacity: number | null;
  avatar_initials: string | null;
  avatar_color: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  deadline: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assignee_id: string | null;
  estimated_hours: number | null;
  client_id: string | null;
  project_id: string | null;
  internal_project_id: string | null;
  completed_at: string | null;
  updated_at: string;
  department: TaskDepartment | null;
  clients: { name?: string; color_hex?: string | null } | null;
};

type ProjectRow = {
  id: string;
  title: string;
  status: ProjectStatus;
  progress: number | null;
  lead_id: string | null;
  team_ids: string[] | null;
  deadline: string | null;
  start_date: string | null;
  client_id?: string | null;
  notes_internal?: string | null;
  notes?: string | null;
  clients?: { name?: string } | null;
  kind: 'client' | 'internal';
};

type InvoiceRow = {
  id: string;
  ref: string;
  client_id: string;
  status: InvoiceStatus;
  total: number;
  due_date: string;
  issue_date: string;
  clients: { name?: string } | null;
};

type VideoRow = {
  id: string;
  title: string;
  status: VideoStatus;
  public_status: string | null;
  shooting_date: string | null;
  client_delivery_at: string | null;
  delivery_deadline: string | null;
  client_id: string | null;
  editor_id: string | null;
  cameraman_id: string | null;
  clients: { name?: string } | null;
};

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] ?? full;
}

function moneyRound(n: number) {
  return Math.round(n * 100) / 100;
}

function activityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) {
    if (entityType === 'invoice') return '/invoices';
    if (entityType === 'payment') return '/payments';
    if (entityType === 'document') return '/documents';
    return null;
  }
  switch (entityType) {
    case 'task':
      return hrefTasksOpenDetail(entityId);
    case 'video':
      return hrefVideosOpenDetailKanban(entityId);
    case 'project':
      return `/projects/${entityId}`;
    case 'internal_project':
      return `/internal/${entityId}`;
    case 'client':
      return `/clients/${entityId}`;
    case 'invoice':
      return '/invoices';
    case 'payment':
      return '/payments';
    case 'quote':
      return `/quotes/${entityId}`;
    case 'employee':
      return `/team/${entityId}`;
    case 'report':
      return `/reports/${entityId}`;
    case 'document':
      return '/documents';
    default:
      return null;
  }
}

function deadlineLabel(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() < now.getTime()) {
    return `En retard · ${formatDistanceToNow(d, { addSuffix: true, locale: fr })}`;
  }
  return format(d, 'd MMM yyyy', { locale: fr });
}

function invoiceResidual(inv: InvoiceRow, paidByInvoice: Map<string, number>): number {
  return invoiceResidualAmount(inv.status, Number(inv.total), paidByInvoice.get(inv.id) ?? 0);
}

function healthFromCounts(critical: boolean, attention: boolean): CockpitHealthLevel {
  if (critical) return 'critical';
  if (attention) return 'attention';
  return 'good';
}

function expectedForMonths(clients: ClientContractRow[], months: { year: number; month: number }[]): number {
  return moneyRound(months.reduce((s, m) => s + expectedMonthlyRevenueFromClients(clients, m.year, m.month), 0));
}

function monthsCoveredByRange(range: CockpitPeriodRange): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const last = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
  while (cursor.getTime() <= last.getTime() && out.length < 6) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

function videoDeliveryOverdue(v: VideoRow): boolean {
  return isVideoDeliveryOverdue({
    status: v.status,
    public_status: v.public_status ?? undefined,
    client_delivery_at: v.client_delivery_at,
    delivery_deadline: v.delivery_deadline,
  });
}

export async function fetchAdminCockpit(
  ctx: AuthContext,
  periodKey: CockpitPeriodKey,
): Promise<AdminCockpitPayload | null> {
  return withDevTime('dashboard cockpit', () => fetchAdminCockpitInner(ctx, periodKey));
}

async function fetchAdminCockpitInner(
  ctx: AuthContext,
  periodKey: CockpitPeriodKey,
): Promise<AdminCockpitPayload | null> {
  if (!ctx.employee || ctx.role !== 'admin') return null;

  const range = resolveCockpitPeriod(periodKey);
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const tomorrow = format(addDays(startOfDay(now), 1), 'yyyy-MM-dd');
  const weekEnd = format(addDays(startOfDay(now), 6), 'yyyy-MM-dd');
  const supabase = await createClient();
  const currency = await getAgencyDisplayCurrency();
  const showFinance = canViewGlobalFinanceStats(ctx.role);
  const { year: goalYear, month: goalMonth } = currentDashboardYearMonth();

  const [
    employeesR,
    openTasksR,
    doneTasksR,
    projectsR,
    internalR,
    invoicesR,
    paymentsR,
    clientsR,
    videosR,
    reportsR,
    quotesR,
    activityLogs,
    goalR,
    vaR,
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, role, weekly_capacity, avatar_initials, avatar_color')
      .is('archived_at', null)
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('tasks')
      .select(
        'id, title, deadline, priority, status, assignee_id, estimated_hours, client_id, project_id, internal_project_id, completed_at, updated_at, department, clients(name, color_hex)',
      )
      .neq('status', 'done')
      .neq('status', 'archived')
      .limit(800),
    supabase
      .from('tasks')
      .select(
        'id, title, deadline, priority, status, assignee_id, estimated_hours, client_id, project_id, internal_project_id, completed_at, updated_at, department, clients(name, color_hex)',
      )
      .eq('status', 'done')
      .gte('updated_at', range.prevStartIso)
      .limit(500),
    supabase
      .from('projects')
      .select('id, title, status, progress, lead_id, team_ids, deadline, start_date, client_id, notes_internal, clients(name)')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(80),
    supabase
      .from('internal_projects')
      .select('id, title, status, progress, owner_id, team_ids, deadline, start_date, notes')
      .neq('status', 'archived')
      .limit(40),
    showFinance
      ? supabase
          .from('invoices')
          .select('id, ref, client_id, status, total, due_date, issue_date, clients(name)')
          .not('status', 'in', '(draft,cancelled)')
          .limit(600)
      : Promise.resolve({ data: [] as InvoiceRow[] }),
    showFinance
      ? supabase
          .from('payments')
          .select('id, invoice_id, client_id, amount, payment_date')
          .gte('payment_date', range.prevStartDay)
          .lte('payment_date', range.endDay)
      : Promise.resolve({ data: [] as { id: string; invoice_id: string; client_id: string; amount: number; payment_date: string }[] }),
    showFinance
      ? supabase.from('clients').select('id, name, status, contract_type, monthly_fee, start_date, end_date')
      : Promise.resolve({ data: [] as (ClientContractRow & { id: string; name: string })[] }),
    supabase
      .from('videos')
      .select(
        'id, title, status, public_status, shooting_date, client_delivery_at, delivery_deadline, client_id, editor_id, cameraman_id, clients(name)',
      )
      .not('status', 'in', '(archived,cancelled)')
      .limit(500),
    supabase.from('reports').select('id, title, client_id, clients(name)').is('sent_at', null).limit(30),
    showFinance
      ? supabase
          .from('quotes')
          .select('id, ref, client_id, status, valid_until, clients(name)')
          .eq('status', 'sent')
          .limit(80)
      : Promise.resolve({ data: [] as { id: string; ref: string; client_id: string; status: string; valid_until: string; clients: { name?: string } | null }[] }),
    listDashboardActivityForVariant('admin', 14).catch(() => []),
    supabase
      .from('agency_monthly_goals')
      .select('revenue_goal')
      .eq('year', goalYear)
      .eq('month', goalMonth)
      .maybeSingle(),
    supabase.from('video_assignments').select('video_id, employee_id').limit(800),
  ]);

  const employees = (employeesR.data ?? []) as EmpRow[];
  const empName = new Map(employees.map((e) => [e.id, e.full_name]));
  const empIds = employees.map((e) => e.id);

  const openTasks = (openTasksR.data ?? []) as TaskRow[];
  const doneTasks = (doneTasksR.data ?? []) as TaskRow[];
  const allTaskIds = [...new Set([...openTasks.map((t) => t.id), ...doneTasks.map((t) => t.id)])];

  const assignMap = new Map<string, string[]>();
  if (allTaskIds.length > 0) {
    const { data: assignRows } = await supabase
      .from('task_assignments')
      .select('task_id, employee_id')
      .in('task_id', allTaskIds.slice(0, 800));
    for (const row of assignRows ?? []) {
      const tid = row.task_id as string;
      const eid = row.employee_id as string;
      const bucket = assignMap.get(tid) ?? [];
      bucket.push(eid);
      assignMap.set(tid, bucket);
    }
  }

  const assigneesOf = (task: TaskRow): string[] => {
    const pivot = assignMap.get(task.id);
    if (pivot && pivot.length > 0) return [...new Set(pivot)];
    return task.assignee_id ? [task.assignee_id] : [];
  };

  const invoices = (invoicesR.data ?? []) as InvoiceRow[];
  const paymentsPeriod = (paymentsR.data ?? []) as {
    id: string;
    invoice_id: string;
    client_id: string;
    amount: number;
    payment_date: string;
  }[];

  const openInvIds = invoices
    .filter((i) => i.status === 'sent' || i.status === 'pending' || i.status === 'overdue')
    .map((i) => i.id);

  const paidByInvoice = new Map<string, number>();
  if (showFinance && openInvIds.length > 0) {
    const { data: alloc } = await supabase.from('payments').select('invoice_id, amount').in('invoice_id', openInvIds);
    for (const row of alloc ?? []) {
      const id = row.invoice_id as string;
      paidByInvoice.set(id, (paidByInvoice.get(id) ?? 0) + Number(row.amount));
    }
  }

  const clients = (clientsR.data ?? []) as (ClientContractRow & { id?: string; name?: string })[];
  const clientName = new Map(
    clients
      .filter((c): c is ClientContractRow & { id: string; name: string } => Boolean(c.id && c.name))
      .map((c) => [c.id, c.name]),
  );

  const collected = moneyRound(
    paymentsPeriod
      .filter((p) => inDayRange(String(p.payment_date).slice(0, 10), range.startDay, range.endDay))
      .reduce((s, p) => s + Number(p.amount), 0),
  );
  const collectedPrev = moneyRound(
    paymentsPeriod
      .filter((p) => inDayRange(String(p.payment_date).slice(0, 10), range.prevStartDay, range.prevEndDay))
      .reduce((s, p) => s + Number(p.amount), 0),
  );

  const monthsNow = monthsCoveredByRange(range);
  const monthsPrev = monthsCoveredByRange({
    ...range,
    start: range.prevStart,
    end: range.prevEnd,
  });
  const expectedRevenue = showFinance ? expectedForMonths(clients, monthsNow) : 0;
  const expectedPrev = showFinance ? expectedForMonths(clients, monthsPrev) : 0;
  const expectedLabel =
    range.key === 'quarter' ? 'CA prévu (trimestre)' : range.key === 'month' ? 'CA prévu ce mois' : 'CA prévu (mois couverts)';

  let outstanding = 0;
  let overdueAmount = 0;
  let unpaidCount = 0;
  let overdueCount = 0;
  let pendingCount = 0;
  let paidCount = 0;
  for (const inv of invoices) {
    if (inv.status === 'paid') {
      paidCount += 1;
      continue;
    }
    if (inv.status === 'cancelled' || inv.status === 'draft') continue;
    const residual = invoiceResidual(inv, paidByInvoice);
    const overdue = isInvoiceOverdueForAlert(inv);
    const pendingLike = inv.status === 'sent' || inv.status === 'pending';
    if (pendingLike) pendingCount += 1;
    if (pendingLike || inv.status === 'overdue') {
      unpaidCount += 1;
      outstanding += residual;
    }
    if (overdue) {
      overdueCount += 1;
      overdueAmount += residual;
    }
  }
  outstanding = moneyRound(outstanding);
  overdueAmount = moneyRound(overdueAmount);

  const videos = (videosR.data ?? []) as VideoRow[];
  const videoAssign = new Map<string, string[]>();
  for (const row of vaR.data ?? []) {
    const vid = row.video_id as string;
    const eid = row.employee_id as string;
    const bucket = videoAssign.get(vid) ?? [];
    bucket.push(eid);
    videoAssign.set(vid, bucket);
  }

  const projects: ProjectRow[] = [
    ...((projectsR.data ?? []) as Omit<ProjectRow, 'kind'>[]).map((p) => ({ ...p, kind: 'client' as const })),
    ...((internalR.data ?? []) as {
      id: string;
      title: string;
      status: ProjectStatus;
      progress: number | null;
      owner_id: string | null;
      team_ids: string[] | null;
      deadline: string | null;
      start_date: string | null;
      notes: string | null;
    }[]).map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      progress: p.progress,
      lead_id: p.owner_id,
      team_ids: p.team_ids,
      deadline: p.deadline,
      start_date: p.start_date,
      notes: p.notes,
      kind: 'internal' as const,
    })),
  ];

  const tasksByProject = new Map<string, TaskRow[]>();
  const tasksByInternal = new Map<string, TaskRow[]>();
  for (const t of openTasks) {
    if (t.project_id) {
      const b = tasksByProject.get(t.project_id) ?? [];
      b.push(t);
      tasksByProject.set(t.project_id, b);
    }
    if (t.internal_project_id) {
      const b = tasksByInternal.get(t.internal_project_id) ?? [];
      b.push(t);
      tasksByInternal.set(t.internal_project_id, b);
    }
  }
  const doneByProject = new Map<string, number>();
  for (const t of doneTasks) {
    const pid = t.project_id || t.internal_project_id;
    if (!pid) continue;
    doneByProject.set(pid, (doneByProject.get(pid) ?? 0) + 1);
  }

  const criticalTasks = openTasks.filter((t) =>
    isTaskUrgentForAlert({ status: t.status, priority: t.priority }),
  ).length;
  const overdueTasks = openTasks.filter((t) => isTaskOverdueForAlert({ status: t.status, deadline: t.deadline, now })).length;

  const hoursByEmp = new Map<string, number>();
  const openByEmp = new Map<string, number>();
  const overdueByEmp = new Map<string, number>();
  const urgentByEmp = new Map<string, number>();
  const inProgressByEmp = new Map<string, number>();
  const todoByEmp = new Map<string, number>();
  const doneByEmp = new Map<string, number>();
  const nextDeadlineByEmp = new Map<string, string>();
  const projectsByEmp = new Map<string, Set<string>>();

  const bump = (map: Map<string, number>, id: string, n = 1) => map.set(id, (map.get(id) ?? 0) + n);

  for (const t of openTasks) {
    const ids = assigneesOf(t);
    const h = Number(t.estimated_hours);
    const base = Number.isFinite(h) && h > 0 ? h : DEFAULT_ESTIMATED_TASK_HOURS;
    const split = ids.length > 0 ? base / ids.length : 0;
    const overdue = isTaskOverdueForAlert({ status: t.status, deadline: t.deadline, now });
    const urgent = isTaskUrgentForAlert({ status: t.status, priority: t.priority });
    for (const eid of ids) {
      bump(hoursByEmp, eid, split);
      bump(openByEmp, eid);
      if (overdue) bump(overdueByEmp, eid);
      if (urgent) bump(urgentByEmp, eid);
      if (t.status === 'todo') bump(todoByEmp, eid);
      if (IN_PROGRESS_TASK_STATUSES.includes(t.status) || t.status === 'blocked' || t.status === 'waiting_client') {
        bump(inProgressByEmp, eid);
      }
      if (t.deadline) {
        const cur = nextDeadlineByEmp.get(eid);
        if (!cur || t.deadline < cur) nextDeadlineByEmp.set(eid, t.deadline);
      }
      const pid = t.project_id || t.internal_project_id;
      if (pid) {
        if (!projectsByEmp.has(eid)) projectsByEmp.set(eid, new Set());
        projectsByEmp.get(eid)!.add(pid);
      }
    }
  }

  for (const t of doneTasks) {
    const stamp = t.completed_at || t.updated_at;
    if (!stamp) continue;
    const day = dayKey(stamp);
    if (!inDayRange(day, range.startDay, range.endDay)) continue;
    for (const eid of assigneesOf(t)) bump(doneByEmp, eid);
  }

  for (const p of projects) {
    if (!ACTIVE_PROJECT_STATUSES.includes(p.status)) continue;
    const members = new Set<string>([...(p.team_ids ?? []), p.lead_id].filter(Boolean) as string[]);
    for (const eid of members) {
      if (!projectsByEmp.has(eid)) projectsByEmp.set(eid, new Set());
      projectsByEmp.get(eid)!.add(p.id);
    }
  }

  const team: CockpitTeamMember[] = employees.map((e) => {
    const cap = Math.max(Number(e.weekly_capacity) || 40, 1);
    const hours = hoursByEmp.get(e.id) ?? 0;
    const hoursPct = Math.min(160, Math.round((hours / cap) * 100));
    const open = openByEmp.get(e.id) ?? 0;
    const overdue = overdueByEmp.get(e.id) ?? 0;
    const next = nextDeadlineByEmp.get(e.id) ?? null;
    return {
      id: e.id,
      name: e.full_name,
      role: e.role,
      roleLabel: ROLE_LABELS[e.role] ?? e.role,
      initials: e.avatar_initials,
      color: e.avatar_color,
      assignedTasks: open,
      overdueTasks: overdue,
      urgentTasks: urgentByEmp.get(e.id) ?? 0,
      activeProjects: projectsByEmp.get(e.id)?.size ?? 0,
      nextDeadline: next,
      nextDeadlineLabel: deadlineLabel(next, now),
      workload: deriveWorkload(open, overdue, hoursPct),
      hoursLoadPercent: Math.min(100, hoursPct),
      openTasks: todoByEmp.get(e.id) ?? 0,
      inProgressTasks: inProgressByEmp.get(e.id) ?? 0,
      completedInPeriod: doneByEmp.get(e.id) ?? 0,
    };
  });

  const overloadedMembers = team.filter((m) => m.workload === 'overloaded').length;

  const upcomingDeliveries = videos.filter((v) => {
    if (['published', 'validated'].includes(v.status)) return false;
    const del = effectiveClientDeliveryIso(v);
    if (!del) return false;
    const day = dayKey(del);
    return day >= today && day <= weekEnd;
  }).length;

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEndDate = endOfWeek(now, { weekStartsOn: 1 });
  const heatDays = enumerateDays(weekStart, weekEndDate).map((d) => ({
    key: format(d, 'yyyy-MM-dd'),
    label: format(d, 'EEE', { locale: fr }),
  }));
  const heatCount = new Map<string, number>();
  const heatKey = (eid: string, day: string) => `${eid}:${day}`;

  const addHeat = (eids: string[], iso: string | null) => {
    if (!iso) return;
    const day = dayKey(iso);
    if (day < heatDays[0].key || day > heatDays[heatDays.length - 1].key) return;
    for (const eid of eids) {
      if (!empIds.includes(eid)) continue;
      const k = heatKey(eid, day);
      heatCount.set(k, (heatCount.get(k) ?? 0) + 1);
    }
  };

  for (const t of openTasks) {
    addHeat(assigneesOf(t), t.deadline);
  }
  for (const v of videos) {
    const people = [
      ...(videoAssign.get(v.id) ?? []),
      v.editor_id,
      v.cameraman_id,
    ].filter(Boolean) as string[];
    addHeat(people, v.shooting_date);
    addHeat(people, effectiveClientDeliveryIso(v));
  }

  const heatmapRows: CockpitHeatmapRow[] = team.map((m) => ({
    employeeId: m.id,
    name: m.name,
    cells: heatDays.map((d) => ({
      dayKey: d.key,
      label: d.label,
      count: heatCount.get(heatKey(m.id, d.key)) ?? 0,
    })),
  }));
  const heatmapHasSignal = heatmapRows.some((r) => r.cells.some((c) => c.count > 0));

  const projectRows: CockpitProjectRow[] = projects
    .filter((p) => ACTIVE_PROJECT_STATUSES.includes(p.status) || p.status === 'validated' || p.status === 'delivered')
    .map((p) => {
      const linked = p.kind === 'client' ? (tasksByProject.get(p.id) ?? []) : (tasksByInternal.get(p.id) ?? []);
      const overdueN = linked.filter((t) => isTaskOverdueForAlert({ status: t.status, deadline: t.deadline, now })).length;
      const blockedN = linked.filter((t) => t.status === 'blocked').length;
      const openN = linked.length;
      const doneN = doneByProject.get(p.id) ?? 0;
      const total = openN + doneN;
      const progress = Number(p.progress) || (total > 0 ? Math.round((doneN / total) * 100) : 0);
      const dl = p.deadline ? String(p.deadline).slice(0, 10) : null;
      return {
        id: p.id,
        href: p.kind === 'client' ? `/projects/${p.id}` : `/internal/${p.id}`,
        name: p.title,
        client: p.kind === 'client' ? (p.clients?.name ?? null) : 'Interne',
        leadName: p.lead_id ? empName.get(p.lead_id) ?? null : null,
        progress,
        phaseLabel: PROJECT_STATUS_MAP[p.status]?.label ?? p.status,
        deadline: dl,
        deadlineLabel: deadlineLabel(dl, now),
        tasksDone: doneN,
        tasksTotal: total,
        overdueTasks: overdueN,
        health: projectHealth({ status: p.status, deadline: dl, overdueTasks: overdueN, blockedTasks: blockedN, now }),
        kind: p.kind,
        startDate: p.start_date ? String(p.start_date).slice(0, 10) : null,
      };
    })
    .sort((a, b) => {
      const rank: Record<CockpitProjectHealth, number> = {
        blocked: 0,
        late: 1,
        attention: 2,
        on_track: 3,
        completed: 4,
      };
      return rank[a.health] - rank[b.health];
    });

  const activeProjects = projectRows.filter((p) => p.health !== 'completed').length;

  const todoCount = openTasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = openTasks.filter((t) => IN_PROGRESS_TASK_STATUSES.includes(t.status)).length;
  const completedInPeriod = doneTasks.filter((t) => {
    const stamp = t.completed_at || t.updated_at;
    return stamp ? inDayRange(dayKey(stamp), range.startDay, range.endDay) : false;
  }).length;
  const openActive = openTasks.filter((t) => t.status !== 'waiting_client').length;
  const completionDenom = completedInPeriod + openActive;
  const completionRate = completionDenom > 0 ? Math.round((completedInPeriod / completionDenom) * 100) : null;

  const actions: CockpitActionItem[] = [];
  const pushAction = (item: CockpitActionItem) => {
    if (actions.some((a) => a.id === item.id)) return;
    actions.push(item);
  };

  for (const t of openTasks) {
    if (!isTaskOverdueForAlert({ status: t.status, deadline: t.deadline, now })) continue;
    if (t.priority !== 'urgent' && t.priority !== 'high') continue;
    pushAction({
      id: `task-od-${t.id}`,
      href: hrefTasksOpenDetail(t.id),
      title: t.title,
      explanation: `Tâche urgente en retard${t.clients?.name ? ` · ${t.clients.name}` : ''}`,
      tone: 'critical',
      deadlineLabel: deadlineLabel(t.deadline, now),
      kind: 'Tâche',
    });
  }
  for (const t of openTasks) {
    if (t.status !== 'blocked') continue;
    pushAction({
      id: `task-bl-${t.id}`,
      href: hrefTasksOpenDetail(t.id),
      title: t.title,
      explanation: 'Tâche bloquée — intervention requise',
      tone: 'late',
      deadlineLabel: deadlineLabel(t.deadline, now),
      kind: 'Tâche',
    });
  }
  for (const inv of invoices) {
    if (!isInvoiceOverdueForAlert(inv)) continue;
    const name = inv.clients?.name ?? clientName.get(inv.client_id) ?? 'Client';
    pushAction({
      id: `inv-od-${inv.id}`,
      href: '/invoices',
      title: `${inv.ref} · ${name}`,
      explanation: `Facture échue depuis le ${format(new Date(`${inv.due_date}T12:00:00`), 'd MMM', { locale: fr })}`,
      tone: 'critical',
      deadlineLabel: inv.due_date,
      kind: 'Facture',
    });
  }
  const dueSoon = format(addDays(now, 7), 'yyyy-MM-dd');
  for (const inv of invoices) {
    if (inv.status !== 'sent' && inv.status !== 'pending') continue;
    if (isInvoiceOverdueForAlert(inv)) continue;
    if (inv.due_date > dueSoon) continue;
    pushAction({
      id: `inv-un-${inv.id}`,
      href: '/invoices',
      title: `${inv.ref} · ${inv.clients?.name ?? 'Client'}`,
      explanation: 'Facture à encaisser — échéance proche',
      tone: 'attention',
      deadlineLabel: inv.due_date,
      kind: 'Facture',
    });
  }
  for (const p of projectRows) {
    if (p.health === 'blocked') {
      pushAction({
        id: `proj-bl-${p.id}`,
        href: p.href,
        title: p.name,
        explanation: p.client ? `Projet bloqué · ${p.client}` : 'Projet bloqué',
        tone: 'late',
        deadlineLabel: p.deadlineLabel,
        kind: 'Projet',
      });
    } else if (p.health === 'late') {
      pushAction({
        id: `proj-late-${p.id}`,
        href: p.href,
        title: p.name,
        explanation: 'Échéance projet dépassée',
        tone: 'late',
        deadlineLabel: p.deadlineLabel,
        kind: 'Projet',
      });
    } else if (p.health === 'attention' && p.deadline) {
      pushAction({
        id: `proj-soon-${p.id}`,
        href: p.href,
        title: p.name,
        explanation: 'Projet à surveiller — échéance proche ou retards tâches',
        tone: 'attention',
        deadlineLabel: p.deadlineLabel,
        kind: 'Projet',
      });
    }
  }
  for (const m of team) {
    if (m.workload !== 'overloaded') continue;
    pushAction({
      id: `emp-ov-${m.id}`,
      href: `/team/${m.id}`,
      title: m.name,
      explanation: `${m.overdueTasks} tâche(s) en retard · ${m.assignedTasks} ouvertes`,
      tone: 'attention',
      deadlineLabel: m.nextDeadlineLabel,
      kind: 'Équipe',
    });
  }
  for (const v of videos) {
    if (v.status !== 'shooting_planned' && v.status !== 'shooting_in_progress') continue;
    if (!v.shooting_date) continue;
    const day = dayKey(v.shooting_date);
    if (day !== today) continue;
    pushAction({
      id: `shoot-${v.id}`,
      href: hrefVideosOpenDetailKanban(v.id),
      title: v.title,
      explanation: v.clients?.name ? `Tournage aujourd’hui · ${v.clients.name}` : 'Tournage aujourd’hui',
      tone: 'today',
      deadlineLabel: 'Aujourd’hui',
      kind: 'Tournage',
    });
  }
  for (const v of videos) {
    if (!videoDeliveryOverdue(v)) continue;
    pushAction({
      id: `vid-od-${v.id}`,
      href: hrefVideosOpenDetailKanban(v.id),
      title: v.title,
      explanation: 'Livrable vidéo en retard',
      tone: 'late',
      deadlineLabel: deadlineLabel(effectiveClientDeliveryIso(v), now),
      kind: 'Vidéo',
    });
  }
  for (const v of videos) {
    const ps = v.public_status;
    if (ps !== 'in_validation' && v.status !== 'sent_to_client') continue;
    pushAction({
      id: `val-${v.id}`,
      href: hrefVideosOpenDetailKanban(v.id),
      title: v.title,
      explanation: 'Validation client en attente',
      tone: 'attention',
      deadlineLabel: null,
      kind: 'Validation',
    });
  }
  for (const r of reportsR.data ?? []) {
    const row = r as { id: string; title: string; clients: { name?: string } | null };
    pushAction({
      id: `rep-${row.id}`,
      href: `/reports/${row.id}`,
      title: row.title,
      explanation: row.clients?.name ? `Rapport non envoyé · ${row.clients.name}` : 'Rapport non envoyé',
      tone: 'upcoming',
      deadlineLabel: null,
      kind: 'Rapport',
    });
  }
  for (const q of quotesR.data ?? []) {
    const row = q as { id: string; ref: string; valid_until: string; clients: { name?: string } | null };
    if (!row.valid_until) continue;
    const until = String(row.valid_until).slice(0, 10);
    const soon = until >= today && until <= format(addDays(now, 7), 'yyyy-MM-dd');
    const expired = until < today;
    if (!soon && !expired) continue;
    pushAction({
      id: `quote-${row.id}`,
      href: `/quotes/${row.id}`,
      title: `${row.ref} · ${row.clients?.name ?? 'Client'}`,
      explanation: expired ? 'Devis expiré — relance commerciale' : 'Devis envoyé arrivant à échéance',
      tone: expired ? 'late' : 'upcoming',
      deadlineLabel: until,
      kind: 'Devis',
    });
  }

  const toneRank: Record<CockpitPriorityTone, number> = {
    critical: 0,
    late: 1,
    today: 2,
    attention: 3,
    upcoming: 4,
  };
  actions.sort((a, b) => toneRank[a.tone] - toneRank[b.tone]);
  const actionItems = actions.slice(0, 16);

  const lateProjects = projectRows.filter((p) => p.health === 'late' || p.health === 'blocked').length;
  const overdueDeliveries = videos.filter((v) => videoDeliveryOverdue(v)).length;

  const financeLevel = healthFromCounts(overdueCount >= 2, unpaidCount > 0);
  const executionLevel = healthFromCounts(overdueTasks >= 8 || lateProjects >= 2, overdueTasks > 0 || lateProjects > 0);
  const teamLevel = healthFromCounts(overloadedMembers >= 2, overloadedMembers >= 1);
  const deliveryLevel = healthFromCounts(overdueDeliveries >= 2, overdueDeliveries > 0 || upcomingDeliveries > 0);

  const health: CockpitAgencyHealth = {
    finance: financeLevel,
    execution: executionLevel,
    team: teamLevel,
    delivery: deliveryLevel,
    score: Math.round(
      (HEALTH_SCORE[financeLevel] +
        HEALTH_SCORE[executionLevel] +
        HEALTH_SCORE[teamLevel] +
        HEALTH_SCORE[deliveryLevel]) /
        4,
    ),
    notes: {
      finance:
        overdueCount > 0
          ? `${overdueCount} facture(s) en retard`
          : unpaidCount > 0
            ? `${unpaidCount} facture(s) non soldée(s)`
            : 'Aucune créance en retard',
      execution:
        overdueTasks > 0
          ? `${overdueTasks} tâche(s) en retard`
          : lateProjects > 0
            ? `${lateProjects} projet(s) à risque`
            : 'Exécution dans les temps',
      team:
        overloadedMembers > 0
          ? `${overloadedMembers} personne(s) en surcharge`
          : 'Charge équipe sous contrôle',
      delivery:
        overdueDeliveries > 0
          ? `${overdueDeliveries} livrable(s) en retard`
          : upcomingDeliveries > 0
            ? `${upcomingDeliveries} livraison(s) cette semaine`
            : 'Pas de livrable en retard',
    },
  };

  let chartDays = enumerateDays(range.start, range.end);
  if (range.key === 'today') {
    chartDays = enumerateDays(addDays(startOfDay(now), -6), now);
  }
  if (range.key === 'quarter' && chartDays.length > 21) {
    const weekly: Date[] = [];
    for (let i = 0; i < chartDays.length; i += 7) weekly.push(chartDays[i]);
    chartDays = weekly;
  }

  const collectedByDay = new Map<string, number>();
  for (const p of paymentsPeriod) {
    const day = String(p.payment_date).slice(0, 10);
    collectedByDay.set(day, (collectedByDay.get(day) ?? 0) + Number(p.amount));
  }

  const chart: CockpitRevenuePoint[] = chartDays.map((d, idx) => {
    const key = format(d, 'yyyy-MM-dd');
    let collectedPoint = 0;
    if (range.key === 'quarter' && chartDays.length < enumerateDays(range.start, range.end).length) {
      const next = chartDays[idx + 1];
      const until = next ? format(addDays(next, -1), 'yyyy-MM-dd') : range.endDay;
      for (const [day, amt] of collectedByDay) {
        if (day >= key && day <= until) collectedPoint += amt;
      }
    } else {
      collectedPoint = collectedByDay.get(key) ?? 0;
    }
    const isLast = idx === chartDays.length - 1;
    const showExpected = range.key === 'month' || range.key === 'quarter';
    let expected: number | null = null;
    if (showExpected) {
      expected = expectedMonthlyRevenueFromClients(clients, d.getFullYear(), d.getMonth() + 1);
    }
    return {
      key,
      label: formatPeriodAxisLabel(key, range.key === 'today' ? '7d' : range.key),
      expected,
      collected: moneyRound(collectedPoint),
      remaining: isLast ? outstanding : null,
    };
  });
  {
    let run = 0;
    for (const pt of chart) {
      run = moneyRound(run + pt.collected);
      pt.collected = run;
    }
  }

  const byClient = new Map<string, number>();
  for (const p of paymentsPeriod) {
    const day = String(p.payment_date).slice(0, 10);
    if (!inDayRange(day, range.startDay, range.endDay)) continue;
    byClient.set(p.client_id, (byClient.get(p.client_id) ?? 0) + Number(p.amount));
  }
  const revenueByClient: CockpitClientRevenue[] = [...byClient.entries()]
    .map(([clientId, amount]) => ({
      clientId,
      name: clientName.get(clientId) ?? 'Client',
      amount: moneyRound(amount),
    }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 7);

  const upcomingPayments = invoices
    .filter((inv) => (inv.status === 'sent' || inv.status === 'pending') && inv.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 6)
    .map((inv) => ({
      id: inv.id,
      href: '/invoices',
      title: `${inv.ref} · ${inv.clients?.name ?? 'Client'}`,
      dueLabel: format(new Date(`${inv.due_date}T12:00:00`), 'd MMM', { locale: fr }),
      amount: invoiceResidual(inv, paidByInvoice),
    }));

  const deadlineItems: CockpitDeadlineItem[] = [];
  const pushDeadline = (item: CockpitDeadlineItem) => {
    if (deadlineItems.some((d) => d.id === item.id)) return;
    deadlineItems.push(item);
  };
  const bucketOf = (day: string): CockpitDeadlineItem['bucket'] | null => {
    if (day === today) return 'today';
    if (day === tomorrow) return 'tomorrow';
    if (day > tomorrow && day <= weekEnd) return 'week';
    return null;
  };

  for (const t of openTasks) {
    if (!t.deadline) continue;
    const day = dayKey(t.deadline);
    const bucket = bucketOf(day);
    if (!bucket) continue;
    if (!OPEN_TASK_STATUSES.includes(t.status)) continue;
    pushDeadline({
      id: `dl-task-${t.id}`,
      href: hrefTasksOpenDetail(t.id),
      title: t.title,
      meta: t.clients?.name ?? 'Tâche',
      at: t.deadline,
      bucket,
      kind: 'task',
    });
  }
  for (const p of projectRows) {
    if (!p.deadline || p.health === 'completed') continue;
    const bucket = bucketOf(p.deadline);
    if (!bucket) continue;
    pushDeadline({
      id: `dl-proj-${p.id}`,
      href: p.href,
      title: p.name,
      meta: p.client ?? 'Projet',
      at: p.deadline,
      bucket,
      kind: 'project',
    });
  }
  for (const v of videos) {
    if (v.shooting_date) {
      const day = dayKey(v.shooting_date);
      const bucket = bucketOf(day);
      if (bucket && (v.status === 'shooting_planned' || v.status === 'shooting_in_progress' || v.status === 'brief_validated')) {
        pushDeadline({
          id: `dl-shoot-${v.id}`,
          href: hrefVideosOpenDetailKanban(v.id),
          title: v.title,
          meta: v.clients?.name ? `Tournage · ${v.clients.name}` : 'Tournage',
          at: v.shooting_date,
          bucket,
          kind: 'shoot',
        });
      }
    }
    const del = effectiveClientDeliveryIso(v);
    if (del && !['published', 'archived', 'cancelled'].includes(v.status)) {
      const day = dayKey(del);
      const bucket = bucketOf(day);
      if (bucket) {
        pushDeadline({
          id: `dl-del-${v.id}`,
          href: hrefVideosOpenDetailKanban(v.id),
          title: v.title,
          meta: v.clients?.name ? `Livraison · ${v.clients.name}` : 'Livraison vidéo',
          at: del,
          bucket,
          kind: 'video_delivery',
        });
      }
    }
  }
  for (const inv of invoices) {
    if (inv.status === 'paid' || inv.status === 'cancelled' || inv.status === 'draft') continue;
    const bucket = bucketOf(inv.due_date);
    if (!bucket) continue;
    pushDeadline({
      id: `dl-inv-${inv.id}`,
      href: '/invoices',
      title: inv.ref,
      meta: inv.clients?.name ?? 'Facture',
      at: inv.due_date,
      bucket,
      kind: 'invoice',
    });
  }
  deadlineItems.sort((a, b) => a.at.localeCompare(b.at));

  const activity: CockpitActivityItem[] = activityLogs.map((log) => ({
    id: log.id,
    href: activityHref(log.entity_type, log.entity_id),
    summary: formatActivityLogSummaryLine(log),
    at: log.created_at,
    atLabel: format(new Date(log.created_at), 'd MMM · HH:mm', { locale: fr }),
  }));

  const departmentsPresent = [
    ...new Set(openTasks.map((t) => t.department).filter((d): d is TaskDepartment => Boolean(d))),
  ];

  const expectedPct = percentChange(expectedRevenue, expectedPrev);
  const collectedPct = percentChange(collected, collectedPrev);
  const expectedDelta =
    showFinance && expectedPct != null ? { percent: expectedPct, previousLabel: range.previousLabel } : null;
  const collectedDelta =
    showFinance && collectedPct != null ? { percent: collectedPct, previousLabel: range.previousLabel } : null;

  return {
    periodKey: range.key,
    periodLabel: range.label,
    currency,
    generatedAt: now.toISOString(),
    overview: {
      expectedRevenue,
      expectedLabel,
      expectedDelta,
      collected,
      collectedDelta,
      remaining: outstanding,
      unpaidInvoices: unpaidCount,
      overdueInvoices: overdueCount,
      activeProjects,
      criticalTasks,
      overdueTasks,
      overloadedMembers,
      upcomingDeliveries,
    },
    health,
    actions: actionItems,
    finance: {
      expectedRevenue,
      expectedLabel,
      collected,
      pending: outstanding,
      overdueAmount,
      unpaidCount,
      overdueCount,
      upcomingPayments,
      chart,
      invoiceStatus: { paid: paidCount, pending: pendingCount, overdue: overdueCount },
      revenueByClient,
      goal: goalR.data ? Number((goalR.data as { revenue_goal?: number }).revenue_goal) || null : null,
    },
    team,
    heatmap: { days: heatDays, rows: heatmapRows, hasSignal: heatmapHasSignal },
    projects: projectRows.filter((p) => p.health !== 'completed').slice(0, 24),
    tasks: {
      todo: todoCount,
      inProgress: inProgressCount,
      completed: completedInPeriod,
      overdue: overdueTasks,
      completionRate,
    },
    deadlines: deadlineItems.slice(0, 24),
    activity,
    departmentsPresent,
    greeting: {
      firstName: firstName(ctx.employee.full_name),
      fullName: ctx.employee.full_name,
      roleLabel: ROLE_LABELS[ctx.employee.role] ?? ctx.employee.role,
      dateLabel: format(now, 'EEEE d MMMM yyyy', { locale: fr }),
    },
  };
}
