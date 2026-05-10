'use client';

import { useMemo, useState } from 'react';
import {
  addDays,
  format,
  isBefore,
  isSameDay,
  isSameWeek,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { PortalCalendarEvent } from '@/lib/portal/calendar-events';
import { portalEventMatchesFilter, type PortalCalendarFilterId } from '@/lib/portal/calendar-events';
import { Badge } from '@/components/ui/badge';

const FILTERS: { id: PortalCalendarFilterId; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'shooting', label: 'Tournages' },
  { id: 'video', label: 'Vidéos' },
  { id: 'publication', label: 'Publications' },
  { id: 'payment', label: 'Paiements' },
  { id: 'project', label: 'Projets' },
  { id: 'report', label: 'Rapports' },
];

/**
 * Priorité dominante pour une journée (bordure puce) :
 * retard facture > échéance proche > validation > tournage > livraisons > reste.
 */
type AccentKey = 'red' | 'amber' | 'purple' | 'blue' | 'green' | 'orange' | 'teal' | 'muted';

function actionablePast(e: PortalCalendarEvent): boolean {
  return (
    e.type === 'payment_due' ||
    e.type === 'invoice_overdue' ||
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

/** Score élevé = plus urgent pour la bordure du jour. */
function eventToAccent(e: PortalCalendarEvent, now: Date): { key: AccentKey; priority: number } {
  const c = classify(e, now);

  if (e.type === 'invoice_overdue' || (c === 'overdue' && (e.type === 'payment_due' || e.type === 'quote_validity'))) {
    return { key: 'red', priority: 100 };
  }
  if (e.tone === 'payment_soon' && (e.type === 'payment_due' || e.type === 'quote_validity')) {
    return { key: 'amber', priority: 75 };
  }
  if (e.type === 'video_validation' || e.type === 'revision') {
    return { key: 'purple', priority: 72 };
  }
  if (e.type === 'shoot') {
    return { key: 'blue', priority: 60 };
  }
  if (e.type === 'publication') {
    return { key: 'purple', priority: 58 };
  }
  if (e.type === 'video_delivery') {
    return { key: 'green', priority: 50 };
  }
  if (e.type === 'project_delivery') {
    return { key: 'orange', priority: 48 };
  }
  if (e.type === 'project_milestone') {
    return { key: 'orange', priority: 45 };
  }
  if (e.type === 'roadmap') {
    return { key: 'teal', priority: 32 };
  }
  if (e.type === 'report') {
    return { key: 'teal', priority: 42 };
  }
  if (e.type === 'invoice_paid') {
    return { key: 'green', priority: 35 };
  }
  if (e.type === 'payment_due' || e.type === 'quote_validity') {
    return { key: 'amber', priority: 40 };
  }
  return { key: 'muted', priority: 10 };
}

const DOT_CLASS: Record<AccentKey, string> = {
  red: 'bg-red-600 dark:bg-red-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  purple: 'bg-violet-600 dark:bg-violet-400',
  blue: 'bg-blue-600 dark:bg-blue-400',
  green: 'bg-emerald-600 dark:bg-emerald-400',
  orange: 'bg-orange-500 dark:bg-orange-400',
  teal: 'bg-teal-600 dark:bg-teal-400',
  muted: 'bg-muted-foreground/50',
};

const CHIP_BORDER_BG: Record<AccentKey, string> = {
  red: 'border-red-500/65 bg-red-500/[0.09] dark:border-red-400/55 dark:bg-red-500/[0.12]',
  amber: 'border-amber-500/65 bg-amber-500/[0.1] dark:border-amber-400/55 dark:bg-amber-500/[0.12]',
  purple: 'border-violet-500/65 bg-violet-500/[0.09] dark:border-violet-400/55 dark:bg-violet-500/[0.11]',
  blue: 'border-blue-500/65 bg-blue-500/[0.09] dark:border-blue-400/55 dark:bg-blue-500/[0.11]',
  green: 'border-emerald-500/65 bg-emerald-500/[0.09] dark:border-emerald-400/55 dark:bg-emerald-500/[0.11]',
  orange: 'border-orange-500/65 bg-orange-500/[0.1] dark:border-orange-400/55 dark:bg-orange-500/[0.11]',
  teal: 'border-teal-500/65 bg-teal-500/[0.09] dark:border-teal-400/55 dark:bg-teal-500/[0.11]',
  muted: '',
};

const CARD_LEFT: Record<AccentKey, string> = {
  red: 'border-l-red-600 dark:border-l-red-400',
  amber: 'border-l-amber-600 dark:border-l-amber-400',
  purple: 'border-l-violet-600 dark:border-l-violet-400',
  blue: 'border-l-blue-600 dark:border-l-blue-400',
  green: 'border-l-emerald-600 dark:border-l-emerald-400',
  orange: 'border-l-orange-600 dark:border-l-orange-400',
  teal: 'border-l-teal-600 dark:border-l-teal-400',
  muted: 'border-l-border',
};

const CARD_SURFACE: Record<AccentKey, string> = {
  red: 'bg-red-500/[0.04] dark:bg-red-500/[0.07]',
  amber: 'bg-amber-500/[0.05] dark:bg-amber-500/[0.08]',
  purple: 'bg-violet-500/[0.04] dark:bg-violet-500/[0.07]',
  blue: 'bg-blue-500/[0.04] dark:bg-blue-500/[0.07]',
  green: 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07]',
  orange: 'bg-orange-500/[0.05] dark:bg-orange-500/[0.08]',
  teal: 'bg-teal-500/[0.04] dark:bg-teal-500/[0.07]',
  muted: 'bg-card/90',
};

type DayMeta = {
  hasEvent: boolean;
  dominant: AccentKey;
  dots: AccentKey[];
  extraCount: number;
  hasUrgent: boolean;
};

function computeDayMeta(dayEvents: PortalCalendarEvent[], now: Date): DayMeta {
  if (dayEvents.length === 0) {
    return { hasEvent: false, dominant: 'muted', dots: [], extraCount: 0, hasUrgent: false };
  }
  let maxP = -1;
  let dominant: AccentKey = 'muted';
  for (const e of dayEvents) {
    const { key, priority } = eventToAccent(e, now);
    if (priority > maxP) {
      maxP = priority;
      dominant = key;
    }
  }
  const sorted = [...dayEvents].sort(
    (a, b) => eventToAccent(b, now).priority - eventToAccent(a, now).priority,
  );
  const seen = new Set<AccentKey>();
  const dots: AccentKey[] = [];
  for (const e of sorted) {
    const k = eventToAccent(e, now).key;
    if (k === 'muted') continue;
    if (!seen.has(k)) {
      seen.add(k);
      dots.push(k);
    }
    if (dots.length >= 3) break;
  }
  const extraCount = dayEvents.length > 3 ? dayEvents.length - 3 : 0;
  const hasUrgent = dayEvents.some(
    (e) => eventToAccent(e, now).key === 'red' || e.type === 'invoice_overdue',
  );
  return { hasEvent: true, dominant, dots, extraCount, hasUrgent };
}

function eventsOnDay(events: PortalCalendarEvent[], day: Date): PortalCalendarEvent[] {
  const t = startOfDay(day).getTime();
  return events.filter((e) => startOfDay(parseISO(e.date)).getTime() === t);
}

function entityIdFromEventId(eventId: string): string {
  const i = eventId.indexOf('__');
  return i === -1 ? eventId : eventId.slice(i + 2);
}

function portalEventCta(
  e: PortalCalendarEvent,
  clientId: string,
  token: string,
): { label: string; href: string; external?: boolean } | null {
  const q = (path: string) =>
    `${path}?clientId=${encodeURIComponent(clientId)}&token=${encodeURIComponent(token)}`;
  const id = entityIdFromEventId(e.id);

  switch (e.type) {
    case 'shoot':
    case 'video_delivery':
    case 'video_validation':
    case 'revision':
    case 'publication':
      return { label: 'Voir la vidéo', href: `#portal-video-${id}` };
    case 'payment_due':
    case 'invoice_overdue':
    case 'invoice_paid':
      return { label: 'Voir la facture', href: `#portal-invoice-${id}` };
    case 'quote_validity':
      return { label: 'Voir le devis', href: q(`/api/portal/quotes/${id}/pdf`), external: true };
    case 'project_milestone':
    case 'project_delivery':
      return { label: 'Voir le projet', href: `#portal-project-${id}` };
    case 'report':
      return { label: 'Voir le rapport', href: q(`/api/portal/reports/${id}/pdf`), external: true };
    default:
      return e.href ? { label: 'Voir le détail', href: e.href } : null;
  }
}

function hasTimeComponent(iso: string): boolean {
  if (iso.length <= 10) return false;
  return !/T(00:00:00|12:00:00)(\.000)?Z?$/.test(iso);
}

function EventCard({
  e,
  clientId,
  token,
  compactTime,
  now,
}: {
  e: PortalCalendarEvent;
  clientId: string;
  token: string;
  compactTime?: boolean;
  now: Date;
}) {
  const at = parseISO(e.date);
  const showClock = hasTimeComponent(e.date);
  const dateLine = showClock
    ? format(at, "EEEE d MMMM yyyy · HH:mm", { locale: fr })
    : format(at, 'EEEE d MMMM yyyy', { locale: fr });
  const cta = portalEventCta(e, clientId, token);
  const accent = eventToAccent(e, now);

  const inner = (
    <>
      <div className="flex min-h-[44px] flex-col justify-center gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {compactTime && showClock ? `${format(at, 'HH:mm')} — ` : ''}
            {e.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {compactTime && showClock ? (
              <span className="capitalize">{format(at, 'EEEE d MMMM yyyy', { locale: fr })}</span>
            ) : (
              <span className="capitalize">{dateLine}</span>
            )}
          </p>
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
      {cta ? (
        <a
          href={cta.href}
          target={cta.external ? '_blank' : undefined}
          rel={cta.external ? 'noreferrer' : undefined}
          className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-primary hover:underline"
        >
          {cta.label}
        </a>
      ) : null}
    </>
  );

  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border border-border/55 border-l-[3px] p-4 shadow-sm',
        CARD_LEFT[accent.key],
        CARD_SURFACE[accent.key],
        (accent.key === 'red' || e.type === 'invoice_overdue') &&
          'ring-1 ring-red-500/15 dark:ring-red-400/20',
      )}
    >
      {inner}
    </article>
  );
}

type AgendaSection = { title: string; items: PortalCalendarEvent[] };

function buildMobileAgendaSections(
  agendaDays: { day: Date; items: PortalCalendarEvent[] }[],
  now: Date,
): AgendaSection[] {
  const today0 = startOfDay(now);
  const tomorrow0 = addDays(today0, 1);

  const todayItems: PortalCalendarEvent[] = [];
  const tomorrowItems: PortalCalendarEvent[] = [];
  const restWeek: PortalCalendarEvent[] = [];
  const later: AgendaSection[] = [];

  for (const { day, items } of agendaDays) {
    if (isSameDay(day, today0)) {
      todayItems.push(...items);
    } else if (isSameDay(day, tomorrow0)) {
      tomorrowItems.push(...items);
    } else if (
      isSameWeek(day, today0, { weekStartsOn: 1 }) &&
      !isSameDay(day, today0) &&
      !isSameDay(day, tomorrow0)
    ) {
      restWeek.push(...items);
    } else {
      later.push({
        title: format(day, 'EEEE d MMMM yyyy', { locale: fr }),
        items: items.slice().sort((a, b) => a.sortKey - b.sortKey),
      });
    }
  }

  todayItems.sort((a, b) => a.sortKey - b.sortKey);
  tomorrowItems.sort((a, b) => a.sortKey - b.sortKey);
  restWeek.sort((a, b) => a.sortKey - b.sortKey);

  const out: AgendaSection[] = [];
  if (todayItems.length) out.push({ title: 'Aujourd’hui', items: todayItems });
  if (tomorrowItems.length) out.push({ title: 'Demain', items: tomorrowItems });
  if (restWeek.length) out.push({ title: 'Cette semaine', items: restWeek });
  out.push(...later);
  return out;
}

function DayChip({
  day,
  meta,
  isSelected,
  isToday,
  onClick,
}: {
  day: Date;
  meta: DayMeta;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  const label = format(day, 'EEE', { locale: fr });
  const num = format(day, 'd', { locale: fr });

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`${format(day, 'EEEE d MMMM yyyy', { locale: fr })}${meta.hasEvent ? ', événements prévus' : ''}`}
      className={cn(
        'flex min-h-[52px] min-w-[3.25rem] shrink-0 snap-center flex-col items-center justify-center rounded-xl border-2 px-2.5 py-2 text-center transition-all',
        !meta.hasEvent &&
          !isSelected &&
          'border-border/55 bg-card/85 text-muted-foreground hover:border-border hover:bg-card',
        meta.hasEvent &&
          !isSelected &&
          cn(CHIP_BORDER_BG[meta.dominant], 'text-foreground shadow-sm'),
        isSelected &&
          cn(
            'border-primary bg-primary/[0.14] text-foreground shadow-md ring-2 ring-primary/35 dark:bg-primary/[0.18]',
            meta.hasUrgent && 'ring-red-500/25',
          ),
        isToday &&
          !isSelected &&
          meta.hasEvent &&
          'ring-1 ring-primary/40 ring-offset-2 ring-offset-background dark:ring-offset-background',
        isToday && !isSelected && !meta.hasEvent && 'ring-1 ring-primary/30',
      )}
    >
      <span className="flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase leading-none text-muted-foreground">{label}</span>
        {isToday ? (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-sm shadow-primary/40"
            title="Aujourd’hui"
            aria-hidden
          />
        ) : null}
      </span>
      <span
        className={cn(
          'mt-0.5 text-base font-bold tabular-nums leading-none',
          meta.hasEvent && 'text-foreground',
          !meta.hasEvent && 'text-muted-foreground',
          isSelected && 'text-foreground',
        )}
      >
        {num}
      </span>
      {isToday && !isSelected ? (
        <span className="mt-0.5 text-[9px] font-bold uppercase leading-none text-primary">Auj.</span>
      ) : (
        <span className="mt-0.5 h-3 shrink-0" aria-hidden />
      )}
      <div className="mt-0.5 flex h-4 items-center justify-center gap-1">
        {meta.hasEvent ? (
          <>
            {meta.dots.map((k) => (
              <span key={k} className={cn('h-2 w-2 shrink-0 rounded-full', DOT_CLASS[k])} aria-hidden />
            ))}
            {meta.extraCount > 0 ? (
              <span className="text-[10px] font-bold tabular-nums text-foreground/90">+{meta.extraCount}</span>
            ) : null}
          </>
        ) : (
          <span className="h-2 w-2 rounded-full bg-transparent" aria-hidden />
        )}
      </div>
      {meta.hasUrgent && !isSelected ? (
        <span className="mt-1 h-1 w-6 rounded-full bg-red-500/80 dark:bg-red-400/80" aria-hidden />
      ) : null}
    </button>
  );
}

export function PortalClientCalendar({
  events,
  clientId,
  token,
}: {
  events: PortalCalendarEvent[];
  clientId: string;
  token: string;
}) {
  const [filter, setFilter] = useState<PortalCalendarFilterId>('all');
  const [dayPick, setDayPick] = useState<Date | null>(null);
  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => events.filter((e) => portalEventMatchesFilter(e, filter)), [events, filter]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(startOfDay(now), { weekStartsOn: 1 });
    return Array.from({ length: 14 }, (_, i) => addDays(start, i));
  }, [now]);

  const dayMetas = useMemo(() => {
    const map = new Map<number, DayMeta>();
    for (const d of weekDays) {
      const list = eventsOnDay(filtered, d);
      map.set(startOfDay(d).getTime(), computeDayMeta(list, now));
    }
    return map;
  }, [weekDays, filtered, now]);

  const eventsForSelectedDay = useMemo(() => {
    if (!dayPick) return null;
    return eventsOnDay(filtered, dayPick).sort((a, b) => a.sortKey - b.sortKey);
  }, [dayPick, filtered]);

  const showDayPickerDetail = dayPick !== null;

  const groupedDesktop = useMemo(() => {
    if (showDayPickerDetail) return { overdue: [], today: [], future: [], pastSoft: [] };
    const overdue: PortalCalendarEvent[] = [];
    const today: PortalCalendarEvent[] = [];
    const future: PortalCalendarEvent[] = [];
    const pastSoft: PortalCalendarEvent[] = [];
    for (const e of filtered) {
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
  }, [filtered, now, showDayPickerDetail]);

  const agendaDays = useMemo(() => {
    if (showDayPickerDetail) return [];
    const map = new Map<number, PortalCalendarEvent[]>();
    for (const e of filtered) {
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
  }, [filtered, showDayPickerDetail]);

  const mobileSections = useMemo(
    () => (showDayPickerDetail ? [] : buildMobileAgendaSections(agendaDays, now)),
    [agendaDays, now, showDayPickerDetail],
  );

  if (events.length === 0) {
    return (
      <section className="scroll-mt-6" id="portal-calendar">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <h2 className="text-base font-semibold uppercase tracking-wide text-primary sm:text-sm">Calendrier</h2>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Vos tournages, livraisons, validations et échéances importantes.
        </p>
        <div className="mt-6 rounded-2xl border border-border/70 bg-card/50 px-4 py-10 text-center">
          <p className="font-medium text-foreground">Aucun événement prévu pour le moment.</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Les tournages, validations, livraisons et échéances apparaîtront ici dès qu’ils seront planifiés.
          </p>
        </div>
      </section>
    );
  }

  const chipRow = (
    <div
      className={cn(
        'mt-4 flex gap-2',
        'overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden',
      )}
    >
      {weekDays.map((d) => {
        const isSelected = dayPick !== null && isSameDay(d, dayPick);
        const k = startOfDay(d).getTime();
        const meta = dayMetas.get(k) ?? computeDayMeta([], now);
        return (
          <DayChip
            key={d.toISOString()}
            day={d}
            meta={meta}
            isSelected={isSelected}
            isToday={isSameDay(d, startOfDay(now))}
            onClick={() => setDayPick(isSelected ? null : d)}
          />
        );
      })}
    </div>
  );

  const selectedDayTitle = dayPick
    ? `Événements du ${format(dayPick, 'EEEE d MMMM yyyy', { locale: fr })}`
    : null;

  const dayDetailList = showDayPickerDetail ? (
    <div className="mt-6 space-y-4">
      <h3 className="border-b border-border/60 pb-2 text-sm font-bold uppercase tracking-wide text-foreground">
        {selectedDayTitle}
      </h3>
      {eventsForSelectedDay && eventsForSelectedDay.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Aucun événement ce jour.
        </p>
      ) : (
        <ul className="space-y-3">
          {eventsForSelectedDay?.map((e) => (
            <li key={e.id}>
              <EventCard e={e} clientId={clientId} token={token} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;

  return (
    <section className="scroll-mt-6" id="portal-calendar">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <h2 className="text-base font-semibold uppercase tracking-wide text-primary sm:text-sm">Calendrier</h2>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-right">
          Vos tournages, livraisons, validations et échéances importantes.
        </p>
      </div>

      <p className="mt-3 text-xs font-medium text-muted-foreground">Jours colorés = événements importants.</p>

      {chipRow}

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

      {showDayPickerDetail ? (
        <div className="md:hidden">{dayDetailList}</div>
      ) : (
        <div className="mt-6 space-y-8 md:hidden">
          {mobileSections.length === 0 || mobileSections.every((s) => s.items.length === 0) ? (
            <p className="rounded-xl border border-border/60 bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
              Aucun événement pour cette sélection.
            </p>
          ) : (
            mobileSections.map((section) =>
              section.items.length === 0 ? null : (
                <div key={section.title}>
                  <h3 className="sticky top-0 z-10 border-b border-border/50 bg-background/95 py-2 text-xs font-bold uppercase tracking-wider text-primary backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    {section.title}
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {section.items.map((e) => (
                      <li key={e.id}>
                        <EventCard e={e} clientId={clientId} token={token} compactTime now={now} />
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )
          )}
        </div>
      )}

      {showDayPickerDetail ? (
        <div className="mt-6 hidden md:block">{dayDetailList}</div>
      ) : (
        <div className="mt-6 hidden space-y-8 md:block">
          {groupedDesktop.overdue.length > 0 ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-destructive">En retard</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {groupedDesktop.overdue.map((e) => (
                  <li key={e.id}>
                    <EventCard e={e} clientId={clientId} token={token} now={now} />
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
                    <EventCard e={e} clientId={clientId} token={token} now={now} />
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
                    <EventCard e={e} clientId={clientId} token={token} now={now} />
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
                    <EventCard e={e} clientId={clientId} token={token} now={now} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <p className="rounded-xl border border-border/60 bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
              Aucun événement pour cette sélection.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
