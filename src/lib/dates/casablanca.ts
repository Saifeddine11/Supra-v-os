import 'server-only';

/** Agency operational calendar for Discord reminders. */
export const AGENCY_TIME_ZONE = 'Africa/Casablanca';

function ymdParts(date: Date): { y: string; m: string; d: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AGENCY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return { y, m, d };
}

/** Calendar date `YYYY-MM-DD` in Africa/Casablanca. */
export function casablancaYmd(date: Date = new Date()): string {
  const { y, m, d } = ymdParts(date);
  return `${y}-${m}-${d}`;
}

export function instantCasablancaYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return casablancaYmd(d);
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map((n) => Number(n));
  if (!y || !m || !d) return ymd;
  const utc = Date.UTC(y, m - 1, d + days, 12, 0, 0);
  return casablancaYmd(new Date(utc));
}

/** Hour and minute on the agency calendar (0–23). */
export function casablancaHourMinute(date: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: AGENCY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? '0'),
  };
}

/**
 * UTC ms for a wall-clock time in Africa/Casablanca (handles Ramadan UTC+0).
 */
export function casablancaWallTimeUtcMs(ymd: string, hour: number, minute: number): number {
  const [y, mo, d] = ymd.split('-').map((n) => Number(n));
  if (!y || !mo || !d) return Number.NaN;
  let guess = Date.UTC(y, mo - 1, d, hour - 1, minute, 0);
  for (let i = 0; i < 16; i += 1) {
    const at = new Date(guess);
    const actualYmd = casablancaYmd(at);
    const { hour: h, minute: m } = casablancaHourMinute(at);
    if (actualYmd === ymd && h === hour && m === minute) return guess;
    if (actualYmd === ymd) {
      guess += (hour * 60 + minute - (h * 60 + m)) * 60_000;
      continue;
    }
    guess += (actualYmd < ymd ? 1 : -1) * 60 * 60_000;
  }
  return guess;
}
