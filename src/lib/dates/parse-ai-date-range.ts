import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';

export type ParsedAiDateRange = {
  start: Date;
  end: Date;
  label: string;
};

export type ParseAiDateRangeResult =
  | { ok: true; range: ParsedAiDateRange }
  | { ok: false; ambiguous: true; message: string }
  | { ok: false; ambiguous: false };

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
  décembre: 11,
};

const WEEKDAYS: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

/** Current instant interpreted in Europe/Paris calendar fields. */
export function parisCalendarNow(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

function formatRangeLabel(start: Date, end: Date): string {
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return format(start, 'd MMMM yyyy', { locale: fr });
  }
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `du ${format(start, 'd', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`;
  }
  return `du ${format(start, 'd MMMM yyyy', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`;
}

function dayRange(date: Date, label?: string): ParsedAiDateRange {
  const start = startOfDay(date);
  const end = endOfDay(date);
  return { start, end, label: label ?? formatRangeLabel(start, end) };
}

function resolveDayMonth(day: number, month: number, year: number | undefined, now: Date): Date {
  let y = year ?? now.getFullYear();
  const candidate = new Date(y, month, day, 12, 0, 0, 0);
  if (!year && candidate.getTime() < startOfDay(now).getTime()) {
    candidate.setFullYear(y + 1);
  }
  return candidate;
}

function nextWeekday(targetDay: number, from: Date): Date {
  const base = startOfDay(from);
  const diff = (targetDay - base.getDay() + 7) % 7 || 7;
  return addDays(base, diff);
}

export function parseAiDateRangeFromText(text: string, now = new Date()): ParseAiDateRangeResult {
  const raw = text.trim().toLowerCase();
  if (!raw) return { ok: false, ambiguous: false };

  const parisNow = parisCalendarNow(now);
  const today = startOfDay(parisNow);

  if (/\baujourd['']hui\b|\baujourdhui\b/.test(raw)) {
    return { ok: true, range: dayRange(today, "aujourd'hui") };
  }

  if (/\bdemain\b/.test(raw)) {
    return { ok: true, range: dayRange(addDays(today, 1), 'demain') };
  }

  if (/\bcette fin de semaine\b/.test(raw)) {
    const fri = addDays(startOfWeek(today, { weekStartsOn: 1 }), 4);
    const sun = endOfWeek(today, { weekStartsOn: 1 });
    return {
      ok: true,
      range: {
        start: startOfDay(fri),
        end: endOfDay(sun),
        label: 'cette fin de semaine',
      },
    };
  }

  if (/\bcette semaine\b/.test(raw)) {
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });
    return { ok: true, range: { start, end, label: 'cette semaine' } };
  }

  if (/\bsemaine prochaine\b/.test(raw)) {
    const nextWeekStart = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
    const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });
    return { ok: true, range: { start: nextWeekStart, end: nextWeekEnd, label: 'la semaine prochaine' } };
  }

  if (/\bce mois-ci\b|\bce mois\b/.test(raw)) {
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    return { ok: true, range: { start, end, label: 'ce mois-ci' } };
  }

  if (/\bmois prochain\b/.test(raw)) {
    const anchor = addMonths(today, 1);
    const start = startOfMonth(anchor);
    const end = endOfMonth(anchor);
    return { ok: true, range: { start, end, label: 'le mois prochain' } };
  }

  const rangeMatch = raw.match(
    /\bdu\s+(\d{1,2})(?:\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre))?(?:\s+(\d{4}))?\s+au\s+(\d{1,2})(?:\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre))?(?:\s+(\d{4}))?\b/i,
  );
  if (rangeMatch) {
    const d1 = Number(rangeMatch[1]);
    const m1Key = rangeMatch[2]?.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const m1 = m1Key ? FRENCH_MONTHS[m1Key] : today.getMonth();
    const y1 = rangeMatch[3] ? Number(rangeMatch[3]) : today.getFullYear();
    const d2 = Number(rangeMatch[4]);
    const m2Key = rangeMatch[5]?.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const m2 = m2Key ? FRENCH_MONTHS[m2Key] : m1;
    const y2 = rangeMatch[6] ? Number(rangeMatch[6]) : y1;
    if (m1 === undefined || m2 === undefined) return { ok: false, ambiguous: false };
    const start = startOfDay(new Date(y1, m1, d1));
    const end = endOfDay(new Date(y2, m2, d2));
    return { ok: true, range: { start, end, label: formatRangeLabel(start, end) } };
  }

  for (const [name, day] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(raw)) {
      const target = nextWeekday(day, today);
      return { ok: true, range: dayRange(target, format(target, 'EEEE d MMMM yyyy', { locale: fr })) };
    }
  }

  const dayMonth = raw.match(
    /\b(?:le\s+)?(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s+(\d{4}))?\b/i,
  );
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const monthKey = dayMonth[2].toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const month = FRENCH_MONTHS[monthKey];
    if (month === undefined || day < 1 || day > 31) return { ok: false, ambiguous: false };
    const date = resolveDayMonth(day, month, dayMonth[3] ? Number(dayMonth[3]) : undefined, today);
    return { ok: true, range: dayRange(date) };
  }

  const dayOnly = raw.match(/\b(?:le\s+)?(\d{1,2})(?:\s+(?:du mois|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|janvier|février|fevrier|mars|avril))?\b/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    if (day < 1 || day > 31) return { ok: false, ambiguous: false };
    const monthHint = dayOnly[2]?.trim();
    if (monthHint && monthHint !== 'du mois') {
      const monthKey = monthHint.normalize('NFD').replace(/\p{M}/gu, '');
      const month = FRENCH_MONTHS[monthKey];
      if (month !== undefined) {
        const date = resolveDayMonth(day, month, undefined, today);
        return { ok: true, range: dayRange(date) };
      }
    }
    const date = resolveDayMonth(day, today.getMonth(), undefined, today);
    return { ok: true, range: dayRange(date) };
  }

  return { ok: false, ambiguous: false };
}

export function taskDeadlineInRange(
  deadline: string | null | undefined,
  start: Date,
  end: Date,
): boolean {
  if (!deadline) return false;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t <= end.getTime();
}
