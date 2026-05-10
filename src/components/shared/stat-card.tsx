import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { StatCardData } from '@/data/dashboard-mock';
import { getStatusBlockSurface, getStatusIconBox, statCardUiToneToBlockTone } from '@/lib/ui/status-block-tone';

export interface StatCardProps {
  data: StatCardData;
  icon: LucideIcon;
  className?: string;
}

function TrendIcon({ direction }: { direction: NonNullable<StatCardData['trend']>['direction'] }) {
  if (direction === 'up') return <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />;
  if (direction === 'down') return <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />;
  return <Minus className="h-3.5 w-3.5" aria-hidden />;
}

export function StatCard({ data, icon: Icon, className }: StatCardProps) {
  const uiTone = data.tone ?? 'default';
  const blockTone = statCardUiToneToBlockTone(uiTone);

  return (
    <article
      className={cn(
        'relative overflow-hidden p-4 shadow-[0_8px_24px_-16px_rgba(8,7,6,0.22)] dark:shadow-[0_8px_28px_-18px_rgba(255,61,10,0.08)]',
        getStatusBlockSurface(blockTone),
        className
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/[0.05] blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{data.title}</p>
          <p className="mt-2 font-sans text-2xl font-semibold tracking-tight text-foreground">{data.value}</p>
          {data.subtitle ? <p className="mt-1 text-xs text-muted-foreground">{data.subtitle}</p> : null}
          {data.trend ? (
            <p
              className={cn(
                'mt-2 inline-flex items-center gap-1 text-xs font-medium',
                data.trend.direction === 'up' && uiTone !== 'negative' && 'text-emerald-600 dark:text-emerald-400/90',
                data.trend.direction === 'down' && uiTone === 'positive' && 'text-muted-foreground',
                data.trend.direction === 'down' && uiTone === 'negative' && 'text-destructive',
                data.trend.direction === 'down' && uiTone === 'warning' && 'text-amber-700 dark:text-amber-300/90',
                data.trend.direction === 'flat' && 'text-muted-foreground'
              )}
            >
              <TrendIcon direction={data.trend.direction} />
              {data.trend.label}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
            getStatusIconBox(blockTone),
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </article>
  );
}
