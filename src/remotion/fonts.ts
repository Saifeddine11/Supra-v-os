/**
 * Shared typography fonts for the cinematic Reel composition.
 *
 * These are loaded via @remotion/google-fonts so the exact same font files are
 * used in the interactive @remotion/player preview AND in the server render
 * (@remotion/renderer / Chromium) — guaranteeing preview === export.
 *
 * Default agency type system:
 *  - Anton            → heavy condensed display (big statement words)
 *  - Archivo          → clean geometric bold (editorial / captions)
 *  - Playfair Display → elegant serif, incl. italic (companion / luxe)
 */
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';

// latin-ext is required for French diacritics (é, à, ç, œ, …) and typographic
// apostrophes used in the agency's French content.
const SUBSETS = ['latin', 'latin-ext'] as const;

const anton = loadAnton('normal', {
  weights: ['400'],
  subsets: [...SUBSETS],
  ignoreTooManyRequestsWarning: true,
});

const archivo = loadArchivo('normal', {
  weights: ['400', '500', '600', '700', '800', '900'],
  subsets: [...SUBSETS],
  ignoreTooManyRequestsWarning: true,
});

const playfair = loadPlayfair('normal', {
  weights: ['400', '500', '600', '700', '800', '900'],
  subsets: [...SUBSETS],
  ignoreTooManyRequestsWarning: true,
});

// Load the italic faces too so Playfair italic renders correctly.
loadPlayfair('italic', {
  weights: ['400', '500', '600', '700'],
  subsets: [...SUBSETS],
  ignoreTooManyRequestsWarning: true,
});

export type FontKey = 'anton' | 'archivo' | 'playfair';

export const FONT_FAMILIES: Record<FontKey, string> = {
  anton: anton.fontFamily,
  archivo: archivo.fontFamily,
  playfair: playfair.fontFamily,
};

export const FONT_OPTIONS: { key: FontKey; label: string; previewWeight: number }[] = [
  { key: 'anton', label: 'Anton · Display condensé', previewWeight: 400 },
  { key: 'archivo', label: 'Archivo · Bold éditorial', previewWeight: 800 },
  { key: 'playfair', label: 'Playfair · Serif élégant', previewWeight: 500 },
];

export function fontFamilyFor(key: string | null | undefined): string {
  if (key && key in FONT_FAMILIES) {
    return FONT_FAMILIES[key as FontKey];
  }
  return FONT_FAMILIES.anton;
}
