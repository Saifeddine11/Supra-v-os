/**
 * Parse relative French deadline phrases into ISO 8601 (Europe/Paris).
 */
import { getParisWallClock, isPastOperationalDateTime } from '@/lib/dates/validate-future-date';

export function parseFrenchDeadlineText(text: string, now = new Date()): string | null {
  const raw = text.trim().toLowerCase();
  if (!raw) return null;
  if (/\bhier\b|\bavant[\s-]?hier\b|\bdans le pass[ée]\b/.test(raw)) return null;

  const parisNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }),
  );

  let base = new Date(parisNow);
  base.setHours(0, 0, 0, 0);

  if (/\baujourd'hui\b|\baujourdhui\b/.test(raw)) {
    /* keep today */
  } else if (/\bdemain\b/.test(raw)) {
    base.setDate(base.getDate() + 1);
  } else {
    const weekdays: Record<string, number> = {
      dimanche: 0,
      lundi: 1,
      mardi: 2,
      mercredi: 3,
      jeudi: 4,
      vendredi: 5,
      samedi: 6,
    };
    for (const [name, day] of Object.entries(weekdays)) {
      if (raw.includes(name)) {
        let diff = (day - base.getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        base.setDate(base.getDate() + diff);
        break;
      }
    }
  }

  const timeMatch =
    /(?:à|a)\s*(\d{1,2})(?:h|:?(\d{2}))?/.exec(raw) ??
    /\b(\d{1,2})h(?:(\d{2}))?\b/.exec(raw);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = timeMatch[2] ? Number(timeMatch[2]) : 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      base.setHours(hours, minutes, 0, 0);
    } else {
      base.setHours(18, 0, 0, 0);
    }
  } else if (/\bdemain\b|\baujourd'hui\b|\baujourdhui\b/.test(raw)) {
    base.setHours(18, 0, 0, 0);
  } else {
    base.setHours(18, 0, 0, 0);
  }

  const iso = base.toISOString();
  if (isPastOperationalDateTime(iso, now)) return null;
  return iso;
}

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

/** Parse French relative or day-month dates (e.g. demain, 31 mai, dimanche à 10h). */
export function parseFrenchDateText(text: string, now = new Date()): string | null {
  const raw = text.trim();
  if (!raw) return null;
  if (/\bhier\b|\bavant[\s-]?hier\b|\bdans le pass[ée]\b/.test(raw.toLowerCase())) return null;

  if (!Number.isNaN(Date.parse(raw))) {
    const iso = new Date(raw).toISOString();
    return isPastOperationalDateTime(iso, now) ? null : iso;
  }

  const relative = parseFrenchDeadlineText(raw, now);
  if (relative) return relative;

  const dayMonth = raw.match(
    /^(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s+(\d{4}))?(?:\s+(?:à|a)\s*(\d{1,2})(?:h|:?(\d{2}))?)?/i,
  );
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const monthKey = dayMonth[2].toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const month = FRENCH_MONTHS[monthKey];
    if (month === undefined || day < 1 || day > 31) return null;

    let year = dayMonth[3] ? Number(dayMonth[3]) : now.getFullYear();
    const hours = dayMonth[4] ? Number(dayMonth[4]) : 18;
    const minutes = dayMonth[5] ? Number(dayMonth[5]) : 0;
    const candidate = new Date(year, month, day, hours, minutes, 0, 0);
    if (!dayMonth[3]) {
      const current = getParisWallClock(now);
      if (
        year === current.year &&
        month + 1 === current.month &&
        day < current.day
      ) {
        return null;
      }
      if (candidate.getTime() < now.getTime() - 86_400_000) {
        candidate.setFullYear(year + 1);
      }
    }
    const iso = candidate.toISOString();
    return isPastOperationalDateTime(iso, now) ? null : iso;
  }

  return null;
}
