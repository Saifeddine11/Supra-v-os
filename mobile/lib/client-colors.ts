/**
 * Deterministic client color system.
 * Client color answers "who"; event-type color answers "what" (see the
 * calendar event card). Same client always hashes to the same palette entry
 * — stable across renders, screens and sessions.
 *
 * Palette: soft, premium, Apple-like tones readable on the warm off-white
 * ground. `accent` drives dots/bars, `soft` tints card backgrounds (low
 * alpha), `text` is a darker shade safe for small labels.
 */

export interface ClientColor {
  accent: string;
  soft: string;
  text: string;
}

const PALETTE: { accent: string; text: string }[] = [
  { accent: '#D97B4F', text: '#9C4E28' }, // orange
  { accent: '#5B8DBE', text: '#3A6288' }, // blue
  { accent: '#8B7BB8', text: '#5F5187' }, // purple
  { accent: '#5FA97C', text: '#3C7A55' }, // green
  { accent: '#C49A4B', text: '#8C6A28' }, // amber
  { accent: '#C77B96', text: '#94506B' }, // pink
  { accent: '#4FA3A0', text: '#2F7573' }, // teal
  { accent: '#6D7FB5', text: '#485887' }, // indigo
  { accent: '#7A7672', text: '#54514E' }, // graphite
  { accent: '#A07960', text: '#75533E' }, // brown
];

/** Neutral fallback when no client is attached (event-type colors take over). */
export const NO_CLIENT_COLOR: ClientColor = {
  accent: '#A8A19A',
  soft: 'rgba(168, 161, 154, 0.10)',
  text: '#6E6660',
};

/** djb2 — tiny, stable string hash. */
function hash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

const cache = new Map<string, ClientColor>();

export function clientColor(
  clientId: string | null | undefined,
  clientName?: string | null,
): ClientColor {
  const key = clientId?.trim() || clientName?.trim() || '';
  if (!key) return NO_CLIENT_COLOR;
  const cached = cache.get(key);
  if (cached) return cached;
  const entry = PALETTE[hash(key) % PALETTE.length];
  const color: ClientColor = {
    accent: entry.accent,
    soft: `${entry.accent}12`, // ~7% alpha tint
    text: entry.text,
  };
  cache.set(key, color);
  return color;
}
