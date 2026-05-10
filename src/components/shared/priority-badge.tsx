import { cn } from '@/lib/utils/cn';

const map = {
  urgent: 'border-destructive/40 bg-destructive/12 text-destructive',
  high: 'border-orange-500/35 bg-orange-500/10 text-orange-200',
  normal: 'border-border bg-muted text-muted-foreground',
  low: 'border-border bg-muted/80 text-muted-foreground',
} as const;

export function PriorityBadge({
  priority,
  className,
}: {
  priority: keyof typeof map;
  className?: string;
}) {
  const labels: Record<keyof typeof map, string> = {
    urgent: 'Urgent',
    high: 'Haute',
    normal: 'Normale',
    low: 'Basse',
  };
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        map[priority],
        className
      )}
    >
      {labels[priority]}
    </span>
  );
}
