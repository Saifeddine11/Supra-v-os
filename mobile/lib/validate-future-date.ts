/**
 * Operational deadline validation — mirrors the web's
 * validateOperationalFutureDate (src/lib/dates/validate-future-date.ts):
 * dates compared on the Europe/Paris wall clock; past day blocked, today
 * with a past time blocked. Messages copied verbatim.
 */

export const OPERATIONAL_PAST_DATE_MESSAGE = 'La date ne peut pas être dans le passé.';
export const OPERATIONAL_PAST_TIME_MESSAGE = "L'heure sélectionnée est déjà passée.";

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function parisWallClock(date: Date): WallClock {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: get('hour'),
      minute: get('minute'),
    };
  } catch {
    // Rare Intl/timezone gaps: fall back to the device clock.
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }
}

function dayValue(c: WallClock): number {
  return c.year * 10000 + c.month * 100 + c.day;
}

export type DeadlineValidation = { ok: true } | { ok: false; message: string };

/** Validates a picked deadline instant against "not in the past" (Paris). */
export function validateFutureDeadline(deadline: Date, now = new Date()): DeadlineValidation {
  if (Number.isNaN(deadline.getTime())) {
    return { ok: false, message: OPERATIONAL_PAST_DATE_MESSAGE };
  }
  const sel = parisWallClock(deadline);
  const cur = parisWallClock(now);
  if (dayValue(sel) < dayValue(cur)) {
    return { ok: false, message: OPERATIONAL_PAST_DATE_MESSAGE };
  }
  if (dayValue(sel) === dayValue(cur)) {
    const selMin = sel.hour * 60 + sel.minute;
    const curMin = cur.hour * 60 + cur.minute;
    if (selMin < curMin) {
      return { ok: false, message: OPERATIONAL_PAST_TIME_MESSAGE };
    }
  }
  return { ok: true };
}
