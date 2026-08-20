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
