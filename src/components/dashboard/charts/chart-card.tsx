'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function ChartCardEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 px-6 py-10 text-center">
      {Icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground">
          <Icon className="h-5 w-5 opacity-80" />
        </div>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  badge,
  children,
  footer,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[24px] border p-5 shadow-sm backdrop-blur-md sm:p-6',
        className,
      )}
      style={{
        background: 'var(--chart-card-bg)',
        borderColor: 'var(--chart-card-border)',
        boxShadow: 'var(--chart-card-shadow)',
      }}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">{title}</h3>
          {subtitle ? (
            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{subtitle}</p>
          ) : null}
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-border/60 bg-muted/25 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </header>
      <div className={cn('min-w-0', bodyClassName)}>{children}</div>
      {footer ? <div className="mt-4 border-t border-border/40 pt-4">{footer}</div> : null}
    </div>
  );
}
