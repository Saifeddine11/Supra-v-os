'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { hrefVideosOpenDetail } from '@/lib/videos/video-deep-link';
import { Clapperboard, Truck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { CalendarVideoEvent } from '@/lib/data/videos-calendar';
import { getCalendarVideoChipSurface } from '@/lib/ui/status-colors';
import { ClientColorDot } from '@/components/shared/client-color-dot';

export function CalendarVideoChip({
  event: ev,
  density,
}: {
  event: CalendarVideoEvent;
  density: 'month' | 'week';
}) {
  const Icon = ev.kind === 'shoot' ? Clapperboard : Truck;
  const kindLabel = ev.shootLabel ?? (ev.kind === 'shoot' ? 'Tournage' : 'Livraison');
  const at = new Date(ev.at);
  const timeStr = format(at, 'HH:mm', { locale: fr });
  const titleLine =
    density === 'month'
      ? `${kindLabel} · ${ev.clientName}`
      : `${kindLabel} — ${ev.title.slice(0, 42)}${ev.title.length > 42 ? '…' : ''}`;

  const surface = getCalendarVideoChipSurface(
    ev.kind,
    {
      status: ev.status,
      public_status: ev.public_status,
      shooting_date: ev.shooting_date,
      client_delivery_at: ev.client_delivery_at,
      delivery_deadline: ev.delivery_deadline,
    },
    ev.at,
  );

  return (
    <Link
      href={hrefVideosOpenDetail(ev.videoId)}
      className={cn(
        'flex min-w-0 items-start gap-1.5 rounded-lg border border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight text-foreground transition-colors hover:opacity-95',
        surface.border,
        surface.bg,
        density === 'week' && 'min-h-[44px] px-2 py-2 text-xs',
      )}
    >
      <div className="mt-0.5 flex shrink-0 flex-col items-center gap-1" aria-hidden>
        <Icon className="h-3.5 w-3.5 opacity-90" />
        <ClientColorDot hex={ev.client_brand_hex} size="sm" title={ev.clientName} />
      </div>
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
