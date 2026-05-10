'use client';

import { useMemo, useState } from 'react';
import {
  addDays,
  format,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { PortalCalendarEvent } from '@/lib/portal/calendar-events';
import {
  portalCalendarEventSurface,
  portalEventMatchesFilter,
  type PortalCalendarFilterId,
} from '@/lib/portal/calendar-events';
import { Badge } from '@/components/ui/badge';

const FILTERS: { id: PortalCalendarFilterId; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'shooting', label: 'Tournages' },
  { id: 'validation', label: 'Validations' },
  { id: 'payment', label: 'Paiements' },
  { id: 'report', label: 'Rapports' },
  { id: 'publication', label: 'Publications' },
];

function actionablePast(e: PortalCalendarEvent): boolean {
  return (
    e.type === 'invoice_due' ||
    e.type === 'video_validation' ||
    e.type === 'revision' ||
    e.type === 'quote_validity'
  );
}

function classify(
  e: PortalCalendarEvent,
  now: Date,
): 'overdue' | 'today' | 'future' | 'past_soft' {
  const d = startOfDay(parseISO(e.date));
  const t = startOfDay(now);
  if (isSameDay(d, t)) return 'today';
  if (isBefore(d, t)) return actionablePast(e) ? 'overdue' : 'past_soft';
  return 'future';
}

function EventCard({ e }: { e: PortalCalendarEvent }) {
  const at = parseISO(e.date);
  const dateOnly =
    e.date.length <= 10 ||
    /T00:00:00(\.000)?Z?$/.test(e.date) ||
    /T12:00:00(\.000)?Z?$/.test(e.date);
  const dateLine =
    e.type === 'shooting' && !dateOnly
      ? format(at, "EEEE d MMMM yyyy · HH:mm", { locale: fr })
      : format(at, 'EEEE d MMMM yyyy', { locale: fr });

  const inner = (
    <>
      <div className="flex min-h-[44px] flex-col justify-center gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">{e.title}</p>
          <p className="mt-0.5 text-xs capitalize text-muted-foreground">{dateLine}</p>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 border-border/80 text-[10px] font-medium uppercase">
          {e.typeLabel}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/90">{e.status}</span>
      </p>
      {e.description ? (
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{e.description}</p>
      ) : null}
      {e.href ? (
        <a
          href={e.href}
          className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-primary hover:underline"
        >
          Voir le détail
        </a>
      ) : null}
    </>
  );

  return (
    <article className={cn('p-4 shadow-sm', portalCalendarEventSurface(e))}>
      {inner}
    </article>
  );
}

export function PortalClientCalendar({ events }: { events: PortalCalendarEvent[] }) {
  const [filter, setFilter] = useState<PortalCalendarFilterId>('all');
  const [dayPick, setDayPick] = useState<Date | null>(null);
  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(
    () => events.filter((e) => portalEventMatchesFilter(e, filter)),
    [events, filter],
  );

  const byDayPick = useMemo(() => {
    if (!dayPick) return filtered;
    return filtered.filter((e) => isSameDay(startOfDay(parseISO(e.date)), startOfDay(dayPick)));
  }, [filtered, dayPick]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(startOfDay(now), { weekStartsOn: 1 });
    return Array.from({ length: 14 }, (_, i) => addDays(start, i));
  }, [now]);

  const groupedDesktop = useMemo(() => {
    const overdue: PortalCalendarEvent[] = [];
    const today: PortalCalendarEvent[] = [];
    const future: PortalCalendarEvent[] = [];
    const pastSoft: PortalCalendarEvent[] = [];
    for (const e of byDayPick) {
      const c = classify(e, now);
      if (c === 'overdue') overdue.push(e);
      else if (c === 'today') today.push(e);
      else if (c === 'future') future.push(e);
      else pastSoft.push(e);
    }
    overdue.sort((a, b) => a.sortKey - b.sortKey);
    today.sort((a, b) => a.sortKey - b.sortKey);
    future.sort((a, b) => a.sortKey - b.sortKey);
    pastSoft.sort((a, b) => b.sortKey - a.sortKey);
    return { overdue, today, future, pastSoft: pastSoft.slice(0, 8) };
  }, [byDayPick, now]);

  /** Mobile: groupement strict par jour (agenda). */
  const agendaDays = useMemo(() => {
    const map = new Map<number, PortalCalendarEvent[]>();
    for (const e of byDayPick) {
      const d = startOfDay(parseISO(e.date));
      const k = d.getTime();
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    const keys = [...map.keys()].sort((a, b) => a - b);
    return keys.map((k) => ({
      day: new Date(k),
      items: (map.get(k) ?? []).sort((a, b) => a.sortKey - b.sortKey),
    }));
  }, [byDayPick]);

  return (
    <section className="scroll-mt-6" id="portal-calendar">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <h2 className="text-base font-semibold uppercase tracking-wide text-primary sm:text-sm">
            Calendrier
          </h2>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground sm:max-w-md sm:text-right">
          Vos dates importantes (tournages, validations, échéances, rapports). Données visibles uniquement pour
          votre compte.
        </p>
      </div>

      <div className="mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {weekDays.map((d) => {
          const isSelected = Boolean(dayPick) && isSameDay(d, dayPick!);
          const hasEvt = filtered.some((e) => isSameDay(startOfDay(parseISO(e.date)), startOfDay(d)));
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => setDayPick(isSelected ? null : d)}
              className={cn(
                'flex min-h-[48px] min-w-[52px] shrink-0 snap-start flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-colors',
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border/70 bg-card/80 text-muted-foreground hover:border-border',
                isSameDay(d, startOfDay(now)) && !isSelected && 'ring-1 ring-primary/35',
              )}
            >
              <span className="text-[10px] font-medium uppercase">{format(d, 'EEE', { locale: fr })}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{format(d, 'd', { locale: fr })}</span>
              <span
                className={cn('mt-0.5 h-1 w-1 rounded-full', hasEvt ? 'bg-primary' : 'bg-transparent')}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'min-h-[44px] rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
              filter === f.id
                ? 'border-primary bg-primary/12 text-foreground'
                : 'border-border/70 bg-card/60 text-muted-foreground hover:border-border',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Mobile: agenda par jour */}
      <div className="mt-6 space-y-8 lg:hidden">
        {agendaDays.length === 0 ? (
          <p className="rounded-xl border border-border/60 bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            Aucun événement pour cette sélection.
          </p>
        ) : (
          agendaDays.map(({ day, items }) => (
            <div key={day.toISOString()}>
              <h3 className="sticky top-0 z-10 border-b border-border/50 bg-background/95 py-2 text-xs font-bold uppercase tracking-wider text-primary backdrop-blur supports-[backdrop-filter]:bg-background/80">
                {format(day, "EEEE d MMMM yyyy", { locale: fr })}
              </h3>
              <ul className="mt-3 space-y-3">
                {items.map((e) => (
                  <li key={e.id}>
                    <EventCard e={e} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Desktop: sections priorité */}
      <div className="mt-6 hidden space-y-8 lg:block">
        {groupedDesktop.overdue.length > 0 ? (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-destructive">En retard</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {groupedDesktop.overdue.map((e) => (
                <li key={e.id}>
                  <EventCard e={e} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {groupedDesktop.today.length > 0 ? (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Aujourd&apos;hui</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {groupedDesktop.today.map((e) => (
                <li key={e.id}>
                  <EventCard e={e} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {groupedDesktop.future.length > 0 ? (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">À venir</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {groupedDesktop.future.map((e) => (
                <li key={e.id}>
                  <EventCard e={e} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {groupedDesktop.pastSoft.length > 0 ? (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Récemment</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {groupedDesktop.pastSoft.map((e) => (
                <li key={e.id}>
                  <EventCard e={e} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {byDayPick.length === 0 ? (
          <p className="rounded-xl border border-border/60 bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            Aucun événement pour cette sélection.
          </p>
        ) : null}
      </div>
    </section>
  );
}
