'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { CriticalAlertItem } from '@/lib/data/critical-alerts';
import { SectionCard } from '@/components/shared/section-card';
import { cn } from '@/lib/utils/cn';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { getStatusBlockSurface, getStatusIconBox } from '@/lib/ui/status-block-tone';
import type { StatusBlockTone } from '@/lib/ui/status-block-tone';

function toTone(sev: CriticalAlertItem['severity']): StatusBlockTone {
  return sev === 'critical' ? 'danger' : 'warning';
}

export function CriticalAlertsBanner({ items }: { items: CriticalAlertItem[] }) {
  if (items.length === 0) return null;

  return (
    <SectionCard
      title="Actions à traiter"
      description="Retards, livraisons et tournages — uniquement les points encore ouverts."
      className="border-destructive/20 shadow-md shadow-destructive/[0.06] dark:shadow-destructive/[0.12]"
    >
      <ul className="space-y-2">
        {items.map((item) => {
          const tone = toTone(item.severity);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  'flex gap-3 rounded-xl p-3 transition-colors hover:opacity-[0.98]',
                  getStatusBlockSurface(tone, { urgentGlow: tone === 'danger' }),
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                    getStatusIconBox(tone),
                  )}
                >
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.clientBrandHex ? <ClientColorDot hex={item.clientBrandHex} size="sm" /> : null}
                    <span>{item.typeLabel}</span>
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-foreground">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span>
                </span>
                <span className="self-center text-xs font-semibold text-primary">Voir →</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
