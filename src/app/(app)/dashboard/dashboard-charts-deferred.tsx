import { Suspense } from 'react';
import { getAuthContext } from '@/lib/auth/permissions';
import { fetchDashboardChartsPayload } from '@/lib/data/dashboard-charts';
import { DashboardChartsSection } from '@/components/dashboard/dashboard-charts-section';
import type { DashboardVariant } from '@/lib/dashboard/dashboard-variant';
import type { DashboardScope } from '@/lib/data/dashboard-stats';
import type { UserRole } from '@/types/database';
import type { AgencyCurrencyIso } from '@/lib/money/format-money';
import { withDevTime } from '@/lib/perf/dev-time';

function ChartsSkeleton() {
  return (
    <div
      className="grid gap-5 lg:grid-cols-2 lg:gap-6"
      aria-hidden
    >
      <div className="h-56 animate-pulse rounded-2xl border border-border/60 bg-muted/30" />
      <div className="h-56 animate-pulse rounded-2xl border border-border/60 bg-muted/30" />
    </div>
  );
}

async function DashboardChartsInner({
  scope,
  currency,
  variant,
  role,
}: {
  scope: DashboardScope;
  currency: AgencyCurrencyIso;
  variant: DashboardVariant;
  role: UserRole;
}) {
  const ctx = await getAuthContext();
  if (!ctx?.employee) return null;

  const chartsPayload = await withDevTime('dashboard charts', async () => {
    try {
      return await fetchDashboardChartsPayload(ctx, {
        scope,
        agencyDisplayCurrency: currency,
      });
    } catch {
      return {
        currency,
        deadlinesWeek: null,
        revenueByMonth: null,
        criticalByType: [],
        clientPipeline: null,
      };
    }
  });

  return (
    <DashboardChartsSection variant={variant} scope={scope} role={role} charts={chartsPayload} />
  );
}

/** Charts stream after stats so the dashboard shell appears first. */
export function DashboardChartsDeferred(props: {
  scope: DashboardScope;
  currency: AgencyCurrencyIso;
  variant: DashboardVariant;
  role: UserRole;
}) {
  return (
    <Suspense fallback={<ChartsSkeleton />}>
      <DashboardChartsInner {...props} />
    </Suspense>
  );
}
