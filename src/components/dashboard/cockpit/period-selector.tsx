'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils/cn';
import { COCKPIT_PERIOD_LABELS, COCKPIT_PERIODS, type CockpitPeriodKey } from '@/lib/dashboard/period';

export function PeriodSelector({ value }: { value: CockpitPeriodKey }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setPeriod = (key: CockpitPeriodKey) => {
    if (key === value) return;
    const next = new URLSearchParams(params.toString());
    if (key === 'month') next.delete('period');
    else next.set('period', key);
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false });
    });
  };

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-muted/40 p-1',
        pending && 'opacity-70',
      )}
      role="tablist"
      aria-label="Période"
    >
      {COCKPIT_PERIODS.map((key) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setPeriod(key)}
            className={cn(
              'min-h-8 shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {COCKPIT_PERIOD_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}
