import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  subDays,
  subMonths,
  subQuarters,
} from 'date-fns';
import { fr } from 'date-fns/locale';

export const COCKPIT_PERIODS = ['today', '7d', '30d', 'month', 'quarter'] as const;
export type CockpitPeriodKey = (typeof COCKPIT_PERIODS)[number];

export const COCKPIT_PERIOD_LABELS: Record<CockpitPeriodKey, string> = {
  today: 'Aujourd’hui',
  '7d': '7 jours',
  '30d': '30 jours',
  month: 'Ce mois',
  quarter: 'Ce trimestre',
};

export interface CockpitPeriodRange {
  key: CockpitPeriodKey;
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  startIso: string;
  endIso: string;
  startDay: string;
  endDay: string;
  prevStartIso: string;
  prevEndIso: string;
  prevStartDay: string;
  prevEndDay: string;
  label: string;
  /** Libellé court pour les comparaisons (« vs 7 j. préc. »). */
  previousLabel: string;
}

function toIso(d: Date): string {
  return d.toISOString();
}

function toDay(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function parseCockpitPeriod(raw: string | string[] | undefined | null): CockpitPeriodKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && (COCKPIT_PERIODS as readonly string[]).includes(value)) {
    return value as CockpitPeriodKey;
  }
  return 'month';
}

export function resolveCockpitPeriod(key: CockpitPeriodKey, now = new Date()): CockpitPeriodRange {
  const end = endOfDay(now);
  let start: Date;
  let prevStart: Date;
  let prevEnd: Date;
  let previousLabel: string;

  switch (key) {
    case 'today': {
      start = startOfDay(now);
      prevStart = startOfDay(subDays(now, 1));
      prevEnd = endOfDay(subDays(now, 1));
      previousLabel = 'vs hier';
      break;
    }
    case '7d': {
      start = startOfDay(subDays(now, 6));
      prevEnd = endOfDay(subDays(start, 1));
      prevStart = startOfDay(subDays(prevEnd, 6));
      previousLabel = 'vs 7 j. préc.';
      break;
    }
    case '30d': {
      start = startOfDay(subDays(now, 29));
      prevEnd = endOfDay(subDays(start, 1));
      prevStart = startOfDay(subDays(prevEnd, 29));
      previousLabel = 'vs 30 j. préc.';
      break;
    }
    case 'month': {
      start = startOfMonth(now);
      const prevMonth = subMonths(now, 1);
      prevStart = startOfMonth(prevMonth);
      prevEnd = endOfMonth(prevMonth);
      previousLabel = 'vs mois préc.';
      break;
    }
    case 'quarter': {
      start = startOfQuarter(now);
      const prevQ = subQuarters(now, 1);
      prevStart = startOfQuarter(prevQ);
      prevEnd = endOfQuarter(prevQ);
      previousLabel = 'vs trim. préc.';
      break;
    }
  }

  return {
    key,
    start,
    end,
    prevStart,
    prevEnd,
    startIso: toIso(start),
    endIso: toIso(end),
    startDay: toDay(start),
    endDay: toDay(end),
    prevStartIso: toIso(prevStart),
    prevEndIso: toIso(prevEnd),
    prevStartDay: toDay(prevStart),
    prevEndDay: toDay(prevEnd),
    label: COCKPIT_PERIOD_LABELS[key],
    previousLabel,
  };
}

export function dayKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso) : iso;
  return format(d, 'yyyy-MM-dd');
}

export function inDayRange(day: string, startDay: string, endDay: string): boolean {
  return day >= startDay && day <= endDay;
}

export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function enumerateDays(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const last = startOfDay(end);
  let cursor = startOfDay(start);
  const guard = 120;
  let i = 0;
  while (cursor.getTime() <= last.getTime() && i < guard) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    i += 1;
  }
  return out;
}

export function formatPeriodAxisLabel(day: string, key: CockpitPeriodKey): string {
  const d = new Date(`${day}T12:00:00`);
  if (key === 'quarter') return format(d, 'd MMM', { locale: fr });
  if (key === 'month' || key === '30d') return format(d, 'd MMM', { locale: fr });
  return format(d, 'EEE d', { locale: fr });
}

export function spanDays(range: CockpitPeriodRange): number {
  return differenceInCalendarDays(range.end, range.start) + 1;
}
