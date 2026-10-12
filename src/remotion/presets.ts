/**
 * SUPRA V3 — Five cinematic typography presets.
 *
 * A preset is an art-directed TEMPLATE: applying it generates one or more
 * typography layers (position, type, fill, motion already composed to look
 * premium). The editor then lets the human refine every property. Presets are
 * grounded in the agency reference frames (Guéliz, LUXE, L'ACTION, Ehab, …).
 */
import { createLayerId, type TypographyLayer } from './typography';

export type PresetId =
  | 'cinematic_glass'
  | 'editorial_luxe'
  | 'kinetic_statement'
  | 'transparent_impact'
  | 'minimal_film';

export type PresetBuildOptions = {
  /** Where on the clip timeline the generated layers should start. */
  startMs?: number;
  /** Primary text (the big statement word/phrase). */
  headline?: string;
  /** Secondary / companion text. */
  companion?: string;
  /** Optional third line (editorial subtitle). */
  tagline?: string;
};

export type CinematicPreset = {
  id: PresetId;
  name: string;
  description: string;
  /** Builds the layer(s) for this preset. */
  build: (opts?: PresetBuildOptions) => TypographyLayer[];
};

const OFF_WHITE = '#F8F4EF';
const DEEP_INK = '#0B0B0D';

function base(partial: Partial<TypographyLayer>): TypographyLayer {
  return {
    id: createLayerId(),
    text: 'TEXTE',
    font: 'anton',
    fontWeight: 400,
    fontStyle: 'normal',
    fontSize: 0.12,
    letterSpacing: 0,
    lineHeight: 1,
    textTransform: 'none',
    align: 'center',
    x: 0.5,
    y: 0.5,
    maxWidth: 0.92,
    rotation: 0,
    fillMode: 'solid',
    color: OFF_WHITE,
    opacity: 1,
    blendMode: 'normal',
    depth: 'front',
    startMs: 0,
    durationMs: 3200,
    animIn: 'fade',
    animOut: 'fade',
    animDurationMs: 600,
    ...partial,
  };
}

export const CINEMATIC_PRESETS: CinematicPreset[] = [
  {
    id: 'cinematic_glass',
    name: 'Cinematic Glass',
    description: 'Mot-titre géant en texture vidéo (footage dans les lettres), révélé lentement. Réf. « Guéliz ».',
    build: (opts = {}) => {
      const start = opts.startMs ?? 0;
      return [
        base({
          text: opts.headline ?? 'Guéliz',
          font: 'anton',
          fontSize: 0.2,
          textTransform: 'none',
          letterSpacing: -0.01,
          x: 0.5,
          y: 0.64,
          maxWidth: 1.2,
          fillMode: 'video_matte',
          depth: 'front',
          startMs: start,
          durationMs: 4000,
          animIn: 'tracking_in',
          animOut: 'fade',
          animDurationMs: 900,
        }),
      ];
    },
  },
  {
    id: 'editorial_luxe',
    name: 'Editorial Luxe',
    description: 'Hiérarchie magazine : petite italique + mot massif plein + sous-titre. Réf. « le LUXE ».',
    build: (opts = {}) => {
      const start = opts.startMs ?? 0;
      return [
        base({
          text: opts.companion ?? 'le',
          font: 'playfair',
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: 0.06,
          textTransform: 'lowercase',
          x: 0.3,
          y: 0.4,
          maxWidth: 0.6,
          fillMode: 'solid',
          color: OFF_WHITE,
          startMs: start,
          durationMs: 3600,
          animIn: 'slide_right',
          animDurationMs: 550,
        }),
        base({
          text: opts.headline ?? 'LUXE',
          font: 'anton',
          fontSize: 0.26,
          textTransform: 'uppercase',
          letterSpacing: 0,
          x: 0.5,
          y: 0.52,
          maxWidth: 1.1,
          fillMode: 'solid',
          color: OFF_WHITE,
          startMs: start + 150,
          durationMs: 3600,
          animIn: 'scale_in',
          animOut: 'fade',
          animDurationMs: 650,
        }),
        base({
          text: opts.tagline ?? 'ne se voit pas',
          font: 'archivo',
          fontWeight: 700,
          fontSize: 0.05,
          textTransform: 'none',
          letterSpacing: 0.02,
          x: 0.5,
          y: 0.63,
          maxWidth: 0.9,
          fillMode: 'solid',
          color: OFF_WHITE,
          startMs: start + 350,
          durationMs: 3400,
          animIn: 'slide_up',
          animDurationMs: 600,
        }),
      ];
    },
  },
  {
    id: 'kinetic_statement',
    name: 'Kinetic Statement',
    description: 'Mot condensé géant qui déborde, révélé mot-à-mot en texture vidéo. Réf. « L\u2019ACTION ».',
    build: (opts = {}) => {
      const start = opts.startMs ?? 0;
      return [
        base({
          text: opts.headline ?? "L'ACTION",
          font: 'anton',
          fontSize: 0.3,
          textTransform: 'uppercase',
          letterSpacing: -0.01,
          x: 0.5,
          y: 0.46,
          maxWidth: 1.4,
          fillMode: 'video_matte',
          depth: 'front',
          startMs: start,
          durationMs: 3800,
          animIn: 'word_by_word',
          animOut: 'slide_up',
          animDurationMs: 800,
        }),
      ];
    },
  },
  {
    id: 'transparent_impact',
    name: 'Transparent Impact',
    description: 'Titre géant translucide sombre qui chevauche le sujet + ligne italique fine. Réf. « Ehab ».',
    build: (opts = {}) => {
      const start = opts.startMs ?? 0;
      return [
        base({
          text: opts.companion ?? "Moi c'est",
          font: 'playfair',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 0.055,
          textTransform: 'none',
          x: 0.42,
          y: 0.44,
          maxWidth: 0.7,
          fillMode: 'solid',
          color: OFF_WHITE,
          startMs: start,
          durationMs: 3600,
          animIn: 'fade',
          animDurationMs: 600,
        }),
        base({
          text: opts.headline ?? 'Ehab',
          font: 'anton',
          fontSize: 0.26,
          textTransform: 'none',
          x: 0.5,
          y: 0.56,
          maxWidth: 1.1,
          fillMode: 'translucent',
          color: DEEP_INK,
          opacity: 0.55,
          depth: 'front',
          startMs: start + 150,
          durationMs: 3600,
          animIn: 'slide_up',
          animOut: 'fade',
          animDurationMs: 700,
        }),
      ];
    },
  },
  {
    id: 'minimal_film',
    name: 'Minimal Film',
    description: 'Épuré et raffiné : italique fine + mot propre, glissé discret. Réf. « Moi c\u2019est ».',
    build: (opts = {}) => {
      const start = opts.startMs ?? 0;
      return [
        base({
          text: opts.companion ?? 'un film de',
          font: 'playfair',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 0.045,
          textTransform: 'none',
          letterSpacing: 0.04,
          x: 0.5,
          y: 0.46,
          maxWidth: 0.8,
          fillMode: 'solid',
          color: OFF_WHITE,
          startMs: start,
          durationMs: 3400,
          animIn: 'fade',
          animDurationMs: 700,
        }),
        base({
          text: opts.headline ?? 'SUPRA',
          font: 'archivo',
          fontWeight: 800,
          fontSize: 0.1,
          textTransform: 'uppercase',
          letterSpacing: 0.08,
          x: 0.5,
          y: 0.54,
          maxWidth: 0.95,
          fillMode: 'solid',
          color: OFF_WHITE,
          startMs: start + 150,
          durationMs: 3400,
          animIn: 'tracking_in',
          animOut: 'fade',
          animDurationMs: 700,
        }),
      ];
    },
  },
];

export function getPreset(id: string): CinematicPreset | undefined {
  return CINEMATIC_PRESETS.find((p) => p.id === id);
}
