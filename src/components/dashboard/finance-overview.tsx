import { SectionCard } from '@/components/shared/section-card';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import type { FinanceSnapshot } from '@/data/dashboard-mock';
import { MOCK_INVOICES_PREVIEW, REVENUE_CHART } from '@/data/dashboard-mock';
import { cn } from '@/lib/utils/cn';
import { dashboardInvoicePreviewLabelToTone, getStatusBlockSurface } from '@/lib/ui/status-block-tone';

export function FinanceOverview({
  snapshot,
  liveFinance,
}: {
  snapshot: FinanceSnapshot;
  /** Quand défini, remplace les champs correspondants (données Supabase). */
  liveFinance?: Partial<FinanceSnapshot> | null;
}) {
  const s: FinanceSnapshot = { ...snapshot, ...(liveFinance ?? {}) };
  const isLive = liveFinance != null && Object.keys(liveFinance).length > 0;

  return (
    <SectionCard
      title="Finance"
      description={
        isLive
          ? 'Encaissements, impayés et devis : données réelles (montants du mois = factures payées ce mois).'
          : 'Vue condensée — connectez un rôle finance pour les agrégats réels.'
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className={cn('p-3', getStatusBlockSurface('neutral'))}>
            <dt className="text-xs text-muted-foreground">CA du mois</dt>
            <dd className="mt-1 font-semibold text-foreground">{s.monthlyRevenue}</dd>
          </div>
          <div className={cn('p-3', getStatusBlockSurface('neutral'))}>
            <dt className="text-xs text-muted-foreground">Objectif</dt>
            <dd className="mt-1 font-semibold text-foreground">{s.monthlyTarget}</dd>
          </div>
          <div className={cn('p-3', getStatusBlockSurface('success'))}>
            <dt className="text-xs font-medium text-muted-foreground">Encaissé</dt>
            <dd className="mt-1 font-semibold text-foreground">{s.collected}</dd>
          </div>
          <div className={cn('p-3', getStatusBlockSurface('warning'))}>
            <dt className="text-xs font-medium text-muted-foreground">En attente</dt>
            <dd className="mt-1 font-semibold text-foreground">{s.pending}</dd>
          </div>
          <div className={cn('p-3', getStatusBlockSurface('success'))}>
            <dt className="text-xs text-muted-foreground">Factures payées</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">{s.paidInvoicesCount}</dd>
          </div>
          <div className={cn('p-3', getStatusBlockSurface('warning'))}>
            <dt className="text-xs text-muted-foreground">Factures en attente</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">{s.pendingInvoicesCount}</dd>
          </div>
          <div className={cn('p-3', getStatusBlockSurface('danger'))}>
            <dt className="text-xs font-medium text-muted-foreground">En retard</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">{s.overdueInvoicesCount}</dd>
          </div>
          <div className={cn('p-3', getStatusBlockSurface('info'))}>
            <dt className="text-xs text-muted-foreground">Devis acceptés / en attente</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {s.acceptedQuotes} / {s.pendingQuotes}
            </dd>
          </div>
        </dl>
        <div className="space-y-4">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              CA vs objectif (6 mois)
            </p>
            <RevenueChart data={REVENUE_CHART} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Factures (extrait)
            </p>
            <ul className="space-y-1.5 text-sm">
              {MOCK_INVOICES_PREVIEW.map((inv) => (
                <li
                  key={inv.client}
                  className={cn(
                    'grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2.5 py-1.5',
                    getStatusBlockSurface(dashboardInvoicePreviewLabelToTone(inv.status)),
                  )}
                >
                  <span className="min-w-0 truncate text-foreground">{inv.client}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{inv.amount}</span>
                  <span className="shrink-0 text-right text-xs text-primary/90">{inv.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
