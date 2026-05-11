'use client';

import type { ReactNode } from 'react';
import { canViewGlobalFinanceStats } from '@/lib/auth/capabilities';
import type { DashboardVariant } from '@/lib/dashboard/dashboard-variant';
import type { DashboardScope } from '@/lib/data/dashboard-stats';
import type { UserRole } from '@/types/database';
import type { DashboardChartsPayload } from '@/types/dashboard-charts';
import { ClientPipelineChart } from '@/components/dashboard/charts/client-pipeline-chart';
import { CriticalAlertsBreakdown } from '@/components/dashboard/charts/critical-alerts-breakdown';
import { DeadlinesTimelineChart } from '@/components/dashboard/charts/deadlines-timeline-chart';
import { RevenueComboChart } from '@/components/dashboard/charts/revenue-combo-chart';

function Grid2({ children }: { children: [ReactNode, ReactNode] | ReactNode[] }) {
  const [a, b] = children as [ReactNode, ReactNode];
  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
      {a ? <div className="min-w-0">{a}</div> : null}
      {b ? <div className="min-w-0">{b}</div> : null}
    </div>
  );
}

export function DashboardChartsSection({
  variant,
  scope,
  role,
  charts,
}: {
  variant: DashboardVariant;
  scope: DashboardScope;
  role: UserRole;
  charts: DashboardChartsPayload;
}) {
  const financeCharts = canViewGlobalFinanceStats(role) && (scope === 'full' || scope === 'finance');

  const revenueEl = financeCharts ? (
    <RevenueComboChart data={charts.revenueByMonth ?? []} currency={charts.currency} />
  ) : null;

  const criticalEl = <CriticalAlertsBreakdown rows={charts.criticalByType ?? []} />;

  const deadlinesEl =
    charts.deadlinesWeek != null ? <DeadlinesTimelineChart data={charts.deadlinesWeek} /> : null;

  const pipelineEl =
    charts.clientPipeline != null ? <ClientPipelineChart rows={charts.clientPipeline} /> : null;

  const rows: ReactNode[] = [];

  if (variant === 'admin' && scope === 'full') {
    if (revenueEl || criticalEl) rows.push(<Grid2 key="a1">{[revenueEl, criticalEl]}</Grid2>);
    if (deadlinesEl || pipelineEl) rows.push(<Grid2 key="a2">{[deadlinesEl, pipelineEl]}</Grid2>);
  } else if (variant === 'finance' || (financeCharts && scope === 'finance')) {
    if (revenueEl || criticalEl) rows.push(<Grid2 key="f1">{[revenueEl, criticalEl]}</Grid2>);
    if (deadlinesEl) rows.push(<div key="f2">{deadlinesEl}</div>);
  } else if (variant === 'manager') {
    if (deadlinesEl || criticalEl) rows.push(<Grid2 key="p1">{[deadlinesEl, criticalEl]}</Grid2>);
    if (pipelineEl) rows.push(<div key="p2">{pipelineEl}</div>);
  } else if (variant === 'commercial') {
    if (pipelineEl || deadlinesEl) rows.push(<Grid2 key="co1">{[pipelineEl, deadlinesEl]}</Grid2>);
    rows.push(<div key="co2">{criticalEl}</div>);
  } else if (variant === 'individual') {
    if (deadlinesEl || criticalEl) rows.push(<Grid2 key="i1">{[deadlinesEl, criticalEl]}</Grid2>);
  }

  if (rows.length === 0) return null;

  return (
    <section aria-label="Graphiques de pilotage" className="space-y-5 lg:space-y-6">
      {rows}
    </section>
  );
}
