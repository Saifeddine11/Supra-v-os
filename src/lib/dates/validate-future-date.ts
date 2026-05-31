/**
 * Operational planning dates — must not be in the past (Europe/Paris wall clock).
 */
import { format } from 'date-fns';
import { parisCalendarNow } from '@/lib/dates/parse-ai-date-range';

export const OPERATIONAL_PAST_DATE_MESSAGE = 'La date ne peut pas être dans le passé.';
export const OPERATIONAL_PAST_TIME_MESSAGE = "L'heure sélectionnée est déjà passée.";

export const SUPAI_PAST_DATE_REFUSAL =
  'Je ne peux pas planifier une nouvelle échéance dans le passé. Choisissez une date future.';

export type ParisWallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type OperationalDateValidationResult =
  | { ok: true }
  | { ok: false; message: string; kind: 'date' | 'time' | 'invalid' };

export function getParisWallClock(date: Date): ParisWallClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/** yyyy-MM-dd — minimum selectable calendar day (Paris). */
export function getMinOperationalDate(now = new Date()): string {
  return format(parisCalendarNow(now), 'yyyy-MM-dd');
}

/** yyyy-MM-ddTHH:mm — minimum for datetime-local inputs (Paris). */
export function getMinOperationalDatetimeLocal(now = new Date()): string {
  return format(parisCalendarNow(now), "yyyy-MM-dd'T'HH:mm");
}

function parseDatetimeLocalAsParis(value: string): ParisWallClock | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] !== undefined ? Number(m[4]) : 0,
    minute: m[5] !== undefined ? Number(m[5]) : 0,
  };
}

function parseDateOnlyAsParis(value: string): ParisWallClock | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: 0,
    minute: 0,
  };
}

/** Parse datetime-local, date-only, or ISO into Paris wall clock. */
export function parseOperationalDatetimeValue(value: string): ParisWallClock | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const local = parseDatetimeLocalAsParis(trimmed);
  if (local) return local;

  const dateOnly = parseDateOnlyAsParis(trimmed);
  if (dateOnly) return dateOnly;

  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return getParisWallClock(new Date(ms));
}

function compareParisDate(a: ParisWallClock, b: ParisWallClock): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function compareParisDateTime(a: ParisWallClock, b: ParisWallClock): number {
  const dayCmp = compareParisDate(a, b);
  if (dayCmp !== 0) return dayCmp;
  if (a.hour !== b.hour) return a.hour - b.hour;
  return a.minute - b.minute;
}

export function isPastOperationalDate(value: string, now = new Date()): boolean {
  const selected = parseOperationalDatetimeValue(value);
  if (!selected) return false;
  const current = getParisWallClock(now);
  return compareParisDate(selected, current) < 0;
}

export function isPastOperationalDateTime(value: string, now = new Date()): boolean {
  const selected = parseOperationalDatetimeValue(value);
  if (!selected) return false;
  const current = getParisWallClock(now);
  return compareParisDateTime(selected, current) < 0;
}

function operationalDatetimesEqual(a: string, b: string): boolean {
  const pa = parseOperationalDatetimeValue(a);
  const pb = parseOperationalDatetimeValue(b);
  if (!pa || !pb) return a.trim() === b.trim();
  return compareParisDateTime(pa, pb) === 0;
}

export function validateOperationalFutureDate(
  value: string | null | undefined,
  options?: {
    allowEmpty?: boolean;
    /** datetime = date + time rules; date = calendar day only (today allowed). */
    mode?: 'datetime' | 'date';
    now?: Date;
    /** On edit: skip validation when value is unchanged from the stored deadline. */
    unchangedFrom?: string | null;
  },
): OperationalDateValidationResult {
  const allowEmpty = options?.allowEmpty ?? true;
  const mode = options?.mode ?? 'datetime';
  const trimmed = (value ?? '').trim();

  if (
    options?.unchangedFrom?.trim() &&
    trimmed &&
    operationalDatetimesEqual(trimmed, options.unchangedFrom)
  ) {
    return { ok: true };
  }

  if (!trimmed) {
    return allowEmpty ? { ok: true } : { ok: false, message: OPERATIONAL_PAST_DATE_MESSAGE, kind: 'invalid' };
  }

  const selected = parseOperationalDatetimeValue(trimmed);
  if (!selected) {
    return { ok: false, message: OPERATIONAL_PAST_DATE_MESSAGE, kind: 'invalid' };
  }

  const current = getParisWallClock(options?.now ?? new Date());
  const dayCmp = compareParisDate(selected, current);

  if (dayCmp < 0) {
    return { ok: false, message: OPERATIONAL_PAST_DATE_MESSAGE, kind: 'date' };
  }

  if (mode === 'date') {
    return { ok: true };
  }

  if (dayCmp === 0 && compareParisDateTime(selected, current) < 0) {
    return { ok: false, message: OPERATIONAL_PAST_TIME_MESSAGE, kind: 'time' };
  }

  return { ok: true };
}

/** Detect explicit past-date intent in natural language (SupAI). */
export function detectExplicitPastDateIntent(text: string): boolean {
  const raw = text.trim().toLowerCase();
  if (!raw) return false;
  return (
    /\bhier\b|\bavant[\s-]?hier\b|\bpass[ée]\b|\bdans le pass[ée]\b|\bla semaine derni[èe]re\b|\ble mois dernier\b|\bl['']?ann[ée]e derni[èe]re\b/.test(
      raw,
    ) || /\béch[ée]ance\s+(?:au|à|a|en|pour)\s+.+\bpass[ée]\b/.test(raw)
  );
}

/** Ambiguous day-only date that resolves to a past calendar day (e.g. « le 29 » en fin de mois). */
export function detectAmbiguousPastDayOnly(text: string, now = new Date()): string | null {
  const m = text.trim().match(/\b(?:le|pour le|au)\s+(\d{1,2})\b(?!\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre))/i);
  if (!m) return null;
  const day = Number(m[1]);
  if (day < 1 || day > 31) return null;
  const current = getParisWallClock(now);
  if (day >= current.day) return null;
  return `Vous parlez du ${day} de quel mois ? Cette date est déjà passée.`;
}

export function validateOperationalFutureIso(
  iso: string | null | undefined,
  options?: {
    allowEmpty?: boolean;
    now?: Date;
    unchangedFrom?: string | null;
  },
): OperationalDateValidationResult {
  if (!iso?.trim()) {
    return validateOperationalFutureDate(iso, { ...options, mode: 'datetime' });
  }
  return validateOperationalFutureDate(iso, { ...options, mode: 'datetime' });
}
