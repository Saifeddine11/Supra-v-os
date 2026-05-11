'use client';

import { format } from 'date-fns';
import { CalendarRange, CheckSquare, Clapperboard, FileText, Sparkles } from 'lucide-react';
import type { DeadlineWeekDay } from '@/types/dashboard-charts';
import { ChartCard, ChartCardEmpty } from './chart-card';
import { cn } from '@/lib/utils/cn';

const todayKey = () => format(new Date(), 'yyyy-MM-dd');

function Pill({
  count,
  label,
  className,
}: {
  count: number;
  label: string;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums',
        className,
      )}
    >
      <span className="opacity-80">{label}</span>
      <span>{count}</span>
    </span>
  );
}

export function DeadlinesTimelineChart({ data }: { data: DeadlineWeekDay[] }) {
  const tKey = todayKey();
  const total = data.reduce((s, d) => s + d.tasks + d.shoots + d.deliveries + d.invoices + d.quoteFollowups, 0);

  return (
    <ChartCard
      title="Échéances — 7 jours"
      subtitle="Charge à venir : tâches, tournages, livraisons, factures et relances devis selon vos droits."
      bodyClassName="space-y-0"
    >
      {total === 0 ? (
        <ChartCardEmpty
          icon={CalendarRange}
          title="Aucune échéance sur les 7 prochains jours"
          description="Les pastilles apparaîtront dès que des dates tomberont dans cette fenêtre."
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-7 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {data.map((day) => {
            const isToday = day.dayKey === tKey;
            const dayTotal = day.tasks + day.shoots + day.deliveries + day.invoices + day.quoteFollowups;
            const busy = dayTotal >= 4;
            return (
              <div
                key={day.dayKey}
                className={cn(
                  'flex min-w-[108px] shrink-0 flex-col rounded-2xl border p-3 transition-colors sm:min-w-0',
                  isToday
                    ? 'border-[color:var(--chart-orange)]/35 bg-[color:var(--chart-orange-soft)] shadow-sm'
                    : 'border-border/50 bg-muted/10',
                  busy && !isToday && 'border-border/60 bg-muted/15',
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {day.labelShort}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{dayTotal}</p>
                <p className="text-[10px] text-muted-foreground">événement{dayTotal > 1 ? 's' : ''}</p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  <Pill count={day.tasks} label="Tâches" className="bg-[color:var(--chart-blue-soft)] text-[color:var(--chart-blue)]" />
                  <Pill
                    count={day.shoots}
                    label="Tournage"
                    className="bg-[color:var(--chart-violet-soft)] text-[color:var(--chart-violet)]"
                  />
                  <Pill
                    count={day.deliveries}
                    label="Livraison"
                    className="bg-[color:var(--chart-orange-soft)] text-[color:var(--chart-orange)]"
                  />
                  <Pill
                    count={day.invoices}
                    label="Facture"
                    className="bg-[color:var(--chart-emerald-soft)] text-[color:var(--chart-emerald)]"
                  />
                  <Pill
                    count={day.quoteFollowups}
                    label="Devis"
                    className="bg-[color:var(--chart-amber-soft)] text-[color:var(--chart-amber)]"
                  />
                </div>
                {isToday ? (
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-[color:var(--chart-orange)]">
                    <Sparkles className="h-3 w-3" />
                    Aujourd’hui
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {total > 0 ? (
        <div className="mt-4 flex flex-wrap gap-3 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5 text-[color:var(--chart-blue)] opacity-80" />
            Tâches
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clapperboard className="h-3.5 w-3.5 text-[color:var(--chart-violet)] opacity-80" />
            Tournages
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-[color:var(--chart-orange)] opacity-80" />
            Livraisons / factures / devis
          </span>
        </div>
      ) : null}
    </ChartCard>
  );
}
