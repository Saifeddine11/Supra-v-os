/**
 * Couleurs client : pastilles, fonds doux, accents — sans remplacer les couleurs de statut.
 * Toujours des styles inline ou variables CSS (pas de classes Tailwind dynamiques).
 */

export const CLIENT_FALLBACK_PALETTE = [
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F97316',
  '#22C55E',
  '#14B8A6',
  '#CA8A04',
  '#EF4444',
  '#6366F1',
  '#A855F7',
] as const;

export type ClientColorInput = {
  name: string;
  color_hex?: string | null;
};

function hashStringStable(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Valide et normalise en #RRGGBB majuscules, ou null si invalide / vide. */
export function normalizeHexColor(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let s = raw.trim();
  if (!s.startsWith('#')) s = `#${s}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return null;
  return s.toUpperCase();
}

export function isValidClientHex(raw: string): boolean {
  return normalizeHexColor(raw) !== null;
}

/** Couleur stable dérivée du nom (même nom → même teinte). */
export function getClientColorFromName(name: string): string {
  const key = name.trim().toLowerCase() || 'client';
  const idx = hashStringStable(key) % CLIENT_FALLBACK_PALETTE.length;
  return CLIENT_FALLBACK_PALETTE[idx]!;
}

/** Couleur affichée : base si valide, sinon palette dérivée du nom. */
export function getClientColor(client: ClientColorInput): string {
  const fromDb = normalizeHexColor(client.color_hex ?? null);
  if (fromDb) return fromDb;
  return getClientColorFromName(client.name);
}

/** Texte lisible sur un fond plein `hex` (pastilles pleines / badges). */
export function getReadableTextColor(hex: string): '#FFFFFF' | '#0C0A09' {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#0C0A09';
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.52 ? '#0C0A09' : '#FFFFFF';
}

/** Fond doux rgba pour cartes / bandeaux. */
export function getSoftBackgroundColor(hex: string, alpha = 0.12): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(59, 130, 246, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getClientColorStyles(client: ClientColorInput): Record<string, string> {
  const color = getClientColor(client);
  return {
    '--client-color': color,
    '--client-bg-soft': getSoftBackgroundColor(color, 0.14),
    '--client-text-on-soft': getReadableTextColor(color),
  };
}

export function getClientAccent(client: ClientColorInput) {
  const color = getClientColor(client);
  return {
    color,
    bgSoft: getSoftBackgroundColor(color, 0.12),
    border: color,
    textOnBg: getReadableTextColor(color),
  };
}
