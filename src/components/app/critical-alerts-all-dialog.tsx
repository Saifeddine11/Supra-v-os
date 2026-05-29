'use client';

import Link from 'next/link';
import type { CriticalActiveAlertDTO } from '@/lib/notifications/critical-active-types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';

function groupLabel(entityType: string, id: string): string {
  if (entityType === 'task' || id.startsWith('task-od-')) return 'Tâches en retard';
  if (id.startsWith('vid-od-')) return 'Livraisons en retard';
  if (id.startsWith('vid-shoot-')) return 'Tournages';
  if (entityType === 'invoices' || id.startsWith('fin-')) return 'Facturation';
  return 'Autres actions';
}

export function CriticalAlertsAllDialog({
  open,
  onOpenChange,
  alerts,
  totalCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: CriticalActiveAlertDTO[];
  totalCount: number;
}) {
  const groups = new Map<string, CriticalActiveAlertDTO[]>();
  for (const a of alerts) {
    const key = groupLabel(a.entityType, a.id);
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(85vh,640px)] max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle>Toutes les actions à traiter</DialogTitle>
          <DialogDescription>
            {totalCount} action{totalCount > 1 ? 's' : ''} opérationnelle{totalCount > 1 ? 's' : ''} — hors
            terminé, attente client et revue.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(calc(85vh-88px),552px)] overflow-y-auto px-3 py-3">
          {[...groups.entries()].map(([label, items]) => (
            <section key={label} className="mb-4 last:mb-0">
              <h3 className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label} ({items.length})
              </h3>
              <ul className="space-y-1.5">
                {items.map((a) => (
                  <li key={a.id}>
                    <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            'text-[10px] font-semibold uppercase tracking-wide',
                            a.severity === 'critical'
                              ? 'text-[#C2410C] dark:text-[#FF6A2A]'
                              : 'text-muted-foreground',
                          )}
                        >
                          {a.title}
                        </p>
                        <p className="line-clamp-2 text-xs leading-snug text-foreground">{a.message}</p>
                      </div>
                      <Link
                        href={a.href}
                        className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
                        onClick={() => onOpenChange(false)}
                      >
                        Voir
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
