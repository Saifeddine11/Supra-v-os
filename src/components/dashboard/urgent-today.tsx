import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { UrgentItem } from '@/data/dashboard-mock';
import { cn } from '@/lib/utils/cn';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { getStatusBlockSurface, getStatusIconBox } from '@/lib/ui/status-block-tone';
import type { StatusBlockTone } from '@/lib/ui/status-block-tone';

function urgentItemTone(severity: UrgentItem['severity']): StatusBlockTone {
  return severity === 'high' ? 'danger' : 'warning';
}

export function UrgentToday({ items }: { items: UrgentItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
        Aucune urgence aujourd’hui.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const tone = urgentItemTone(item.severity);
        return (
          <li
            key={item.id}
            className={cn(
              'flex gap-3 p-3',
              getStatusBlockSurface(tone, { urgentGlow: tone === 'danger' }),
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                getStatusIconBox(tone),
              )}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.clientBrandHex ? <ClientColorDot hex={item.clientBrandHex} size="sm" /> : null}
                <span>{item.type}</span>
              </p>
              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
          </li>
        );
      })}
    </ul>
  );
}
