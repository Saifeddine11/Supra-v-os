import type { AgencyCurrencyIso } from '@/lib/money/format-money';
import type { CockpitPeriodKey } from '@/lib/dashboard/period';
import type { TaskDepartment, TaskPriority, UserRole } from '@/types/database';

export type CockpitHealthLevel = 'good' | 'attention' | 'critical';
export type CockpitPriorityTone = 'critical' | 'late' | 'today' | 'attention' | 'upcoming';
export type CockpitWorkloadState = 'available' | 'normal' | 'busy' | 'overloaded';
export type CockpitProjectHealth = 'on_track' | 'attention' | 'late' | 'blocked' | 'completed';
export type DeadlineBucket = 'today' | 'tomorrow' | 'week';
export type DeadlineKind = 'task' | 'project' | 'video_delivery' | 'shoot' | 'invoice';

export interface CockpitDelta {
  percent: number | null;
  previousLabel: string;
}

export interface CockpitOverviewMetrics {
  expectedRevenue: number;
  expectedLabel: string;
  expectedDelta: CockpitDelta | null;
  collected: number;
  collectedDelta: CockpitDelta | null;
  remaining: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  activeProjects: number;
  criticalTasks: number;
  overdueTasks: number;
  overloadedMembers: number;
  upcomingDeliveries: number;
}

export interface CockpitAgencyHealth {
  finance: CockpitHealthLevel;
  execution: CockpitHealthLevel;
  team: CockpitHealthLevel;
  delivery: CockpitHealthLevel;
  /** Moyenne transparente des 4 dimensions (good=100, attention=62, critical=28). */
  score: number;
  notes: {
    finance: string;
    execution: string;
    team: string;
    delivery: string;
  };
}

export interface CockpitActionItem {
  id: string;
  href: string;
  title: string;
  explanation: string;
  tone: CockpitPriorityTone;
  deadlineLabel: string | null;
  kind: string;
}

export interface CockpitRevenuePoint {
  key: string;
  label: string;
  expected: number | null;
  collected: number;
  remaining: number | null;
}

export interface CockpitInvoiceStatus {
  paid: number;
  pending: number;
  overdue: number;
}

export interface CockpitClientRevenue {
  clientId: string;
  name: string;
  amount: number;
}

export interface CockpitFinanceBlock {
  expectedRevenue: number;
  expectedLabel: string;
  collected: number;
  pending: number;
  overdueAmount: number;
  unpaidCount: number;
  overdueCount: number;
  upcomingPayments: { id: string; href: string; title: string; dueLabel: string; amount: number }[];
  chart: CockpitRevenuePoint[];
  invoiceStatus: CockpitInvoiceStatus;
  revenueByClient: CockpitClientRevenue[];
  goal: number | null;
}

export interface CockpitTeamMember {
  id: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  initials: string | null;
  color: string | null;
  assignedTasks: number;
  overdueTasks: number;
  urgentTasks: number;
  activeProjects: number;
  nextDeadline: string | null;
  nextDeadlineLabel: string | null;
  workload: CockpitWorkloadState;
  hoursLoadPercent: number;
  openTasks: number;
  inProgressTasks: number;
  completedInPeriod: number;
}

export interface CockpitHeatmapCell {
  dayKey: string;
  label: string;
  count: number;
}

export interface CockpitHeatmapRow {
  employeeId: string;
  name: string;
  cells: CockpitHeatmapCell[];
}

export interface CockpitProjectRow {
  id: string;
  href: string;
  name: string;
  client: string | null;
  leadName: string | null;
  progress: number;
  phaseLabel: string;
  deadline: string | null;
  deadlineLabel: string | null;
  tasksDone: number;
  tasksTotal: number;
  overdueTasks: number;
  health: CockpitProjectHealth;
  kind: 'client' | 'internal';
  startDate: string | null;
}

export interface CockpitTaskStatus {
  todo: number;
  inProgress: number;
  completed: number;
  overdue: number;
  completionRate: number | null;
}

export interface CockpitDeadlineItem {
  id: string;
  href: string;
  title: string;
  meta: string;
  at: string;
  bucket: DeadlineBucket;
  kind: DeadlineKind;
}

export interface CockpitActivityItem {
  id: string;
  href: string | null;
  summary: string;
  at: string;
  atLabel: string;
}

export interface AdminCockpitPayload {
  periodKey: CockpitPeriodKey;
  periodLabel: string;
  currency: AgencyCurrencyIso;
  generatedAt: string;
  overview: CockpitOverviewMetrics;
  health: CockpitAgencyHealth;
  actions: CockpitActionItem[];
  finance: CockpitFinanceBlock;
  team: CockpitTeamMember[];
  heatmap: {
    days: { key: string; label: string }[];
    rows: CockpitHeatmapRow[];
    hasSignal: boolean;
  };
  projects: CockpitProjectRow[];
  tasks: CockpitTaskStatus;
  deadlines: CockpitDeadlineItem[];
  activity: CockpitActivityItem[];
  departmentsPresent: TaskDepartment[];
  greeting: {
    firstName: string;
    fullName: string;
    roleLabel: string;
    dateLabel: string;
  };
}

export type { TaskPriority };
