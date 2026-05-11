'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { Clapperboard, Truck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { CalendarVideoEvent } from '@/lib/data/videos-calendar';

const SURFACE: Record<CalendarVideoEvent['kind'], string> = {
  shoot:
    'border-violet-500/70 bg-violet-500/[0.1] text-foreground dark:border-violet-400/55 dark:bg-violet-500/[0.12]',
  delivery:
    'border-primary/75 bg-primary/[0.1] text-foreground dark:border-primary/60 dark:bg-primary/[0.14]',
};

export function CalendarVideoChip({
  event: ev,
  density,
}: {
  event: CalendarVideoEvent;
  density: 'month' | 'week';
}) {
  const Icon = ev.kind === 'shoot' ? Clapperboard : Truck;
  const kindLabel = ev.kind === 'shoot' ? 'Tournage' : 'Livraison';
  const at = new Date(ev.at);
  const timeStr = format(at, 'HH:mm', { locale: fr });
  const titleLine =
    density === 'month'
      ? `${kindLabel} · ${ev.clientName}`
      : `${kindLabel} — ${ev.title.slice(0, 42)}${ev.title.length > 42 ? '…' : ''}`;

  return (
    <Link
      href="/videos"
      className={cn(
        'flex min-w-0 items-start gap-1.5 rounded-lg border border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight transition-colors hover:opacity-95',
        SURFACE[ev.kind],
        ev.kind === 'shoot' ? 'border-l-violet-600' : 'border-l-primary',
        density === 'week' && 'min-h-[44px] px-2 py-2 text-xs',
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{titleLine}</span>
        {density === 'week' ? (
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
            {ev.clientName} · {timeStr}
          </span>
        ) : (
          <span className="mt-0.5 block text-[10px] text-muted-foreground tabular-nums">{timeStr}</span>
        )}
      </span>
    </Link>
  );
}
