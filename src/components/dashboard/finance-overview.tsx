import { SectionCard } from '@/components/shared/section-card';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import type { FinanceSnapshot } from '@/data/dashboard-mock';
import { MOCK_INVOICES_PREVIEW, REVENUE_CHART } from '@/data/dashboard-mock';

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
          <div className="rounded-xl border border-border/80 bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">CA du mois</dt>
            <dd className="mt-1 font-semibold text-foreground">{s.monthlyRevenue}</dd>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">Objectif</dt>
            <dd className="mt-1 font-semibold text-foreground">{s.monthlyTarget}</dd>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
            <dt className="text-xs text-primary">Encaissé</dt>
            <dd className="mt-1 font-semibold text-foreground">{s.collected}</dd>
          </div>
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.06] p-3">
            <dt className="text-xs text-orange-200">En attente</dt>
            <dd className="mt-1 font-semibold text-foreground">{s.pending}</dd>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">Factures payées</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">{s.paidInvoicesCount}</dd>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">Factures en attente</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">{s.pendingInvoicesCount}</dd>
          </div>
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3">
            <dt className="text-xs text-destructive">En retard</dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">{s.overdueInvoicesCount}</dd>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/60 p-3">
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
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-2.5 py-1.5"
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
