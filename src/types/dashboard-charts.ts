import type { AgencyCurrencyIso } from '@/lib/money/format-money';

export type DeadlineWeekDay = {
  dayKey: string;
  labelShort: string;
  tasks: number;
  shoots: number;
  deliveries: number;
  invoices: number;
  quoteFollowups: number;
};

export type RevenueMonthPoint = {
  year: number;
  month: number;
  label: string;
  expectedRevenue: number;
  collected: number;
  pendingOpen: number;
  revenueGoal: number | null;
};

export type CriticalAlertChartRow = {
  typeLabel: string;
  count: number;
  critical: number;
  warning: number;
};

export type ClientPipelineRow = {
  key: string;
  label: string;
  count: number;
};

export type DashboardChartsPayload = {
  currency: AgencyCurrencyIso;
  deadlinesWeek: DeadlineWeekDay[] | null;
  revenueByMonth: RevenueMonthPoint[] | null;
  criticalByType: CriticalAlertChartRow[] | null;
  clientPipeline: ClientPipelineRow[] | null;
};
