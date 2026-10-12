/**
 * SUPRA V3 — Cinematic typography layer model.
 *
 * Each on-screen text element is an independent, fully-editable layer. This
 * schema is the single source of truth for both the @remotion/player preview
 * and (later) the @remotion/renderer server render, so what the editor shows is
 * exactly what gets exported.
 *
 * Sizes/positions are normalized to the 1080×1920 canvas:
 *   - fontSize, maxWidth are fractions of canvas HEIGHT / WIDTH respectively
 *   - x, y are the normalized CENTER anchor of the text box (0..1)
 * This keeps layers resolution-independent between preview and export.
 */
import { z } from 'zod';

export const FILL_MODES = ['solid', 'translucent', 'video_matte'] as const;
export type FillMode = (typeof FILL_MODES)[number];

export const DEPTHS = ['front', 'behind'] as const;
export type Depth = (typeof DEPTHS)[number];

export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export const TEXT_TRANSFORMS = ['none', 'uppercase', 'lowercase'] as const;

export const ANIM_IN = [
  'none',
  'fade',
  'slide_up',
  'slide_down',
  'slide_left',
  'slide_right',
  'scale_in',
  'mask_wipe',
  'word_by_word',
  'tracking_in',
] as const;
export type AnimIn = (typeof ANIM_IN)[number];

export const ANIM_OUT = ['none', 'fade', 'slide_up', 'slide_down', 'scale_out'] as const;
export type AnimOut = (typeof ANIM_OUT)[number];

export const BLEND_MODES = [
  'normal',
  'screen',
  'overlay',
  'multiply',
  'soft-light',
  'difference',
  'exclusion',
  'lighten',
  'darken',
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export const FONT_KEYS = ['anton', 'archivo', 'playfair'] as const;

export const typographyLayerSchema = z.object({
  id: z.string(),
  text: z.string().default('TEXTE'),

  // Type
  font: z.enum(FONT_KEYS).default('anton'),
  fontWeight: z.number().int().min(100).max(900).default(400),
  fontStyle: z.enum(['normal', 'italic']).default('normal'),
  /** Fraction of canvas HEIGHT (0.02..0.6). 0.12 ≈ 230px. */
  fontSize: z.number().min(0.02).max(0.6).default(0.12),
  /** Letter spacing in em (-0.1..0.6). */
  letterSpacing: z.number().min(-0.1).max(0.6).default(0),
  lineHeight: z.number().min(0.7).max(2).default(1),
  textTransform: z.enum(TEXT_TRANSFORMS).default('none'),
  align: z.enum(TEXT_ALIGNS).default('center'),

  // Layout (normalized center anchor; allow slight off-canvas bleed)
  x: z.number().min(-0.3).max(1.3).default(0.5),
  y: z.number().min(-0.3).max(1.3).default(0.5),
  /** Max text box width as a fraction of canvas WIDTH. */
  maxWidth: z.number().min(0.2).max(1.6).default(0.92),
  rotation: z.number().min(-45).max(45).default(0),

  // Appearance
  fillMode: z.enum(FILL_MODES).default('solid'),
  /** Fill color (solid/translucent) OR tint for matte edges. */
  color: z.string().default('#F8F4EF'),
  opacity: z.number().min(0).max(1).default(1),
  blendMode: z.enum(BLEND_MODES).default('normal'),
  /** Draw in front of or behind the foreground video. */
  depth: z.enum(DEPTHS).default('front'),

  // Timing (ms on the assembled clip timeline)
  startMs: z.number().min(0).default(0),
  durationMs: z.number().min(100).default(3000),

  // Motion
  animIn: z.enum(ANIM_IN).default('fade'),
  animOut: z.enum(ANIM_OUT).default('fade'),
  animDurationMs: z.number().min(0).max(3000).default(600),
});

export type TypographyLayer = z.infer<typeof typographyLayerSchema>;

export const typographyLayersSchema = z.array(typographyLayerSchema);

/** Parse stored typography (jsonb array) into valid layers, dropping bad ones. */
export function parseTypographyLayers(input: unknown): TypographyLayer[] {
  if (!Array.isArray(input)) return [];
  const out: TypographyLayer[] = [];
  for (const raw of input) {
    const parsed = typographyLayerSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

let idCounter = 0;
/** Stable-ish unique id for a new layer (client + server safe). */
export function createLayerId(): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `ty_${Date.now().toString(36)}_${idCounter}_${rand}`;
}

/** Sensible blank layer used by the "add text" action. */
export function createBlankLayer(overrides: Partial<TypographyLayer> = {}): TypographyLayer {
  return typographyLayerSchema.parse({
    id: createLayerId(),
    text: 'NOUVEAU TEXTE',
    font: 'anton',
    fontWeight: 400,
    fontSize: 0.1,
    textTransform: 'uppercase',
    x: 0.5,
    y: 0.5,
    fillMode: 'solid',
    color: '#F8F4EF',
    startMs: 0,
    durationMs: 3000,
    animIn: 'fade',
    animOut: 'fade',
    ...overrides,
  });
}
