import { SectionCard } from '@/components/shared/section-card';
import type { FinanceSnapshot } from '@/data/dashboard-mock';
import { cn } from '@/lib/utils/cn';
import { getStatusBlockSurface } from '@/lib/ui/status-block-tone';

export function FinanceOverview({ snapshot }: { snapshot: FinanceSnapshot }) {
  const s = snapshot;

  return (
    <SectionCard
      title="Finance"
      description="CA prévu (contrats), encaissements réels (paiements), reliquats factures ouvertes et objectif mensuel."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className={cn('p-3', getStatusBlockSurface('neutral'))}>
            <dt className="text-xs text-muted-foreground">CA prévu du mois</dt>
            <dd className="mt-1 font-semibold text-foreground">{s.monthlyRevenue}</dd>
          </div>
          <div className={cn('p-3', getStatusBlockSurface('neutral'))}>
            <dt className="text-xs text-muted-foreground">Objectif CA</dt>
            <dd className="mt-1 font-semibold text-foreground">{s.monthlyTarget}</dd>
            {s.targetDetail ? (
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.targetDetail}</p>
            ) : null}
            {s.targetProgressPercent != null && s.targetProgressPercent >= 0 ? (
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={s.targetProgressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${s.targetProgressPercent}%` }}
                />
              </div>
            ) : null}
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
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Historique CA vs objectif</p>
          <p className="mt-2 leading-relaxed">
            Aucune série agrégée multi-mois n’est encore exposée ici. L’objectif du mois courant provient des paramètres
            agence ; les montants affichés à gauche sont calculés à partir des clients, paiements et factures en base.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
