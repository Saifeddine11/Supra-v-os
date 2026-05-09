import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { UrgentItem } from '@/data/dashboard-mock';
import { cn } from '@/lib/utils/cn';

export function UrgentToday({ items }: { items: UrgentItem[] }) {
  return (
    <ul className="divide-y divide-border/60">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          <span
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
              item.severity === 'high'
                ? 'border-destructive/35 bg-destructive/10 text-destructive'
                : 'border-primary/30 bg-primary/[0.1] text-primary'
            )}
          >
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{item.type}</p>
            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.detail}</p>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
        </li>
      ))}
    </ul>
  );
}
