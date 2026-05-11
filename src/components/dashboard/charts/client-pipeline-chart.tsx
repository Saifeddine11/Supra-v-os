'use client';

import { ChevronRight, GitBranch, Users } from 'lucide-react';
import type { ClientPipelineRow } from '@/types/dashboard-charts';
import { ChartCard, ChartCardEmpty } from './chart-card';

const STEP_ACCENTS = [
  'var(--chart-slate)',
  'var(--chart-blue)',
  'var(--chart-emerald)',
  'var(--chart-orange)',
  'var(--chart-amber)',
  'var(--chart-rose)',
];

export function ClientPipelineChart({ rows }: { rows: ClientPipelineRow[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <ChartCard
      title="Pipeline commercial"
      subtitle="Prospection, devis et statuts clients — vue agrégée (sans montants)."
      bodyClassName="space-y-0"
    >
      {total === 0 ? (
        <ChartCardEmpty
          icon={Users}
          title="Pipeline vide pour l’instant"
          description="Créez des prospects, envoyez des devis ou activez des clients pour alimenter ce flux."
        />
      ) : (
        <>
          <div className="flex items-stretch gap-1 overflow-x-auto pb-1 pt-0.5 sm:gap-2 sm:overflow-visible">
            {rows.map((row, i) => {
              const accent = STEP_ACCENTS[i % STEP_ACCENTS.length];
              const pct = Math.round((row.count / max) * 100);
              return (
                <div key={row.key} className="flex min-w-0 flex-1 items-stretch">
                  <div
                    className="flex min-w-[100px] flex-1 flex-col rounded-2xl border border-border/50 bg-muted/10 p-3 shadow-sm ring-1 ring-inset ring-white/5 sm:min-w-0 sm:p-3.5 dark:ring-white/5"
                  >
                    <p className="text-[11px] font-medium leading-tight text-muted-foreground">{row.label}</p>
                    <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{row.count}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/40">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${accent}, transparent)`,
                          opacity: 0.9,
                        }}
                      />
                    </div>
                  </div>
                  {i < rows.length - 1 ? (
                    <div className="flex w-5 shrink-0 items-center justify-center text-muted-foreground/50 sm:w-6">
                      <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span>
              {total} contact{total > 1 ? 's' : ''} au total dans le pipeline affiché.
            </span>
          </div>
        </>
      )}
    </ChartCard>
  );
}
