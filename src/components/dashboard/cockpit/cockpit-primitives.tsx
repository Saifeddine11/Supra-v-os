import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import type { CockpitHealthLevel, CockpitPriorityTone, CockpitProjectHealth, CockpitWorkloadState } from '@/types/dashboard-cockpit';

export function CockpitSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('content-enter min-w-0', className)}>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="font-sans text-[15px] font-semibold tracking-tight text-foreground sm:text-base">{title}</h2>
          {description ? <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function CockpitEmpty({
  title,
  description,
  href,
  hrefLabel,
}: {
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex min-h-[140px] flex-col justify-center rounded-2xl bg-muted/15 px-5 py-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
      {href && hrefLabel ? (
        <Link href={href} className="mt-3 text-xs font-semibold text-primary hover:underline">
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

const TONE_PILL: Record<CockpitPriorityTone, string> = {
  critical: 'bg-destructive/15 text-destructive',
  late: 'bg-destructive/10 text-destructive',
  today: 'bg-primary/12 text-primary',
  attention: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  upcoming: 'bg-muted/60 text-muted-foreground',
};

const TONE_LABEL: Record<CockpitPriorityTone, string> = {
  critical: 'Critique',
  late: 'En retard',
  today: 'Aujourd’hui',
  attention: 'Attention',
  upcoming: 'À venir',
};

export function PriorityPill({ tone }: { tone: CockpitPriorityTone }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', TONE_PILL[tone])}>
      {TONE_LABEL[tone]}
    </span>
  );
}

const HEALTH_LABEL: Record<CockpitHealthLevel, string> = {
  good: 'Bon',
  attention: 'Attention',
  critical: 'Critique',
};

const HEALTH_CLASS: Record<CockpitHealthLevel, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  attention: 'text-amber-700 dark:text-amber-400',
  critical: 'text-destructive',
};

export function HealthLabel({ level }: { level: CockpitHealthLevel }) {
  return <span className={cn('font-medium', HEALTH_CLASS[level])}>{HEALTH_LABEL[level]}</span>;
}

const WORKLOAD_LABEL: Record<CockpitWorkloadState, string> = {
  available: 'Disponible',
  normal: 'Normale',
  busy: 'Occupé',
  overloaded: 'Surchargé',
};

const WORKLOAD_CLASS: Record<CockpitWorkloadState, string> = {
  available: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
  normal: 'bg-muted/70 text-muted-foreground',
  busy: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  overloaded: 'bg-destructive/15 text-destructive',
};

export function WorkloadPill({ state }: { state: CockpitWorkloadState }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', WORKLOAD_CLASS[state])}>
      {WORKLOAD_LABEL[state]}
    </span>
  );
}

const PROJECT_LABEL: Record<CockpitProjectHealth, string> = {
  on_track: 'Dans les temps',
  attention: 'Attention',
  late: 'En retard',
  blocked: 'Bloqué',
  completed: 'Terminé',
};

const PROJECT_CLASS: Record<CockpitProjectHealth, string> = {
  on_track: 'text-emerald-600 dark:text-emerald-400',
  attention: 'text-amber-700 dark:text-amber-400',
  late: 'text-destructive',
  blocked: 'text-destructive',
  completed: 'text-muted-foreground',
};

export function ProjectHealthLabel({ health }: { health: CockpitProjectHealth }) {
  return <span className={cn('text-xs font-medium', PROJECT_CLASS[health])}>{PROJECT_LABEL[health]}</span>;
}

export function DeltaBadge({ percent, label }: { percent: number | null; label: string }) {
  if (percent == null) return null;
  const up = percent > 0;
  const flat = percent === 0;
  return (
    <span
      className={cn(
        'text-[11px] font-medium tabular-nums',
        flat ? 'text-muted-foreground' : up ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
      )}
    >
      {up ? '+' : ''}
      {percent}% {label}
    </span>
  );
}

export function QuietLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn('rounded-sm text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60', className)}>
      {children}
    </Link>
  );
}
