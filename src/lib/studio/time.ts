/**
 * Reels Studio — time helpers (pure, client-safe).
 * Internal representation is milliseconds; UI uses mm:ss.t timecodes.
 */

/** 73400 → "01:13.4" */
export function msToTimecode(ms: number, withMillis = true): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = ms / 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const tenths = Math.floor((ms % 1000) / 100);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  const base = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  return withMillis ? `${base}.${tenths}` : base;
}

/** Accepts "mm:ss", "mm:ss.t", "hh:mm:ss(.t)" → ms (or null if invalid). */
export function timecodeToMs(input: string): number | null {
  const trimmed = input.trim();
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(trimmed);
  if (!m) {
    // plain seconds like "12.5"
    const asNum = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(asNum)) return Math.round(asNum * 1000);
    return null;
  }
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const sec = Number(m[3]);
  const frac = m[4] ? Number((m[4] + '000').slice(0, 3)) : 0;
  if (min > 59 || sec > 59) return null;
  return ((h * 3600 + min * 60 + sec) * 1000) + frac;
}

export function clampMs(ms: number, min: number, max: number): number {
  return Math.min(Math.max(ms, min), max);
}

export function secondsToMs(sec: number): number {
  return Math.round(sec * 1000);
}

export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/** Human duration "1 min 13 s". */
export function humanDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s} s`;
  return `${m} min ${String(s).padStart(2, '0')} s`;
}
