'use client';

import {
  AlertCircle,
  CalendarClock,
  Camera,
  CircleDollarSign,
  ClipboardCheck,
  Film,
  type LucideIcon,
} from 'lucide-react';
import type { CriticalAlertChartRow } from '@/types/dashboard-charts';
import { ChartCard, ChartCardEmpty } from './chart-card';
import { cn } from '@/lib/utils/cn';

function styleForLabel(label: string): { color: string; bg: string; Icon: LucideIcon } {
  const l = label.toLowerCase();
  if (l.includes('facturation') || l.includes('facture')) {
    return { color: 'var(--chart-emerald)', bg: 'var(--chart-emerald-soft)', Icon: CircleDollarSign };
  }
  if (l.includes('tournage')) {
    return { color: 'var(--chart-violet)', bg: 'var(--chart-violet-soft)', Icon: Camera };
  }
  if (l.includes('livraison')) {
    return { color: 'var(--chart-orange)', bg: 'var(--chart-orange-soft)', Icon: Film };
  }
  if (l.includes('validation')) {
    return { color: 'var(--chart-blue)', bg: 'var(--chart-blue-soft)', Icon: ClipboardCheck };
  }
  if (l.includes('tâche')) {
    return { color: 'var(--chart-blue)', bg: 'var(--chart-blue-soft)', Icon: AlertCircle };
  }
  return { color: 'var(--chart-slate)', bg: 'var(--chart-slate-soft)', Icon: CalendarClock };
}

export function CriticalAlertsBreakdown({ rows }: { rows: CriticalAlertChartRow[] }) {
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((r) => r.count));
  const total = sorted.reduce((s, r) => s + r.count, 0);
  const totalCritical = sorted.reduce((s, r) => s + r.critical, 0);

  return (
    <ChartCard
      title="Alertes actives — par type"
      subtitle="Même liste que la bannière critique et l’API /api/notifications/critical-active (aperçu synthétique)."
      badge={total > 0 ? `${total} alerte${total > 1 ? 's' : ''}` : undefined}
      bodyClassName="space-y-0"
    >
      {total === 0 ? (
        <ChartCardEmpty
          icon={AlertCircle}
          title="Aucune alerte active"
          description="Quand des retards ou blocages apparaîtront, ils seront ventilés ici par type."
        />
      ) : (
        <div className="max-h-[min(320px,52vh)] space-y-3 overflow-y-auto pr-1">
          {sorted.map((row) => {
            const { color, bg, Icon } = styleForLabel(row.typeLabel);
            const pct = Math.round((row.count / max) * 100);
            return (
              <div
                key={row.typeLabel}
                className="rounded-2xl border border-border/40 bg-muted/5 p-3 sm:p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: bg, color }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-snug text-foreground">{row.typeLabel}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {row.critical} critique{row.critical > 1 ? 's' : ''} · {row.warning} veille
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-muted/30 px-2 py-1 text-xs font-semibold tabular-nums text-foreground">
                    {row.count}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500 ease-out')}
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${color}, ${color}99)`,
                      opacity: 0.85,
                    }}
                  />
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-[11px] text-muted-foreground">
            {totalCritical > 0
              ? `${totalCritical} point${totalCritical > 1 ? 's' : ''} en criticité élevée.`
              : 'Priorité veille — surveiller les échéances.'}
          </p>
        </div>
      )}
    </ChartCard>
  );
}
