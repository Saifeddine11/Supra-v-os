/**
 * SUPRA V3 — Reel composition model.
 *
 * This is the SINGLE source of truth for how a Reel is composed. It is used by:
 *   - the in-editor preview (@remotion/player)
 *   - (later phases) the server render (@remotion/renderer)
 *
 * Phase 2 scope: non-cropped 9:16 composition with a synchronized blurred
 * background and a contained foreground. Typography layers are added on top of
 * this same model in a later phase.
 */
import { z } from 'zod';

import type { TypographyLayer } from './typography';

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;

/** Background layer — full-canvas blurred copy of the source video. */
export const backgroundSchema = z.object({
  /** Only mode for now: reuse the source video itself as a blurred cover. */
  mode: z.literal('blur_self').default('blur_self'),
  /** Gaussian blur radius in canvas px (1080×1920 space). */
  blur: z.number().min(0).max(160).default(60),
  /** Dimming overlay opacity (0..0.8) for typography contrast. */
  dim: z.number().min(0).max(0.8).default(0.28),
});

/** Foreground layer — the untouched, non-cropped source video. */
export const foregroundSchema = z.object({
  /** Always `contain` — the source is never cropped. */
  fit: z.literal('contain').default('contain'),
  /** Vertical offset as a fraction of canvas height (-0.4..0.4). 0 = centered. */
  offsetY: z.number().min(-0.4).max(0.4).default(0),
  /** Scale relative to full canvas width (0.5..1). 1 = full available width. */
  scale: z.number().min(0.5).max(1).default(1),
});

export const reelCompositionSchema = z.object({
  background: backgroundSchema.default({}),
  foreground: foregroundSchema.default({}),
});

export type ReelCompositionModel = z.infer<typeof reelCompositionSchema>;

export const DEFAULT_COMPOSITION: ReelCompositionModel = {
  background: { mode: 'blur_self', blur: 60, dim: 0.28 },
  foreground: { fit: 'contain', offsetY: 0, scale: 1 },
};

/**
 * Parse any stored/partial composition into a complete, valid model.
 * Falls back to defaults for missing/invalid fields so legacy clips (created
 * before the composition model existed) always render.
 */
export function parseComposition(input: unknown): ReelCompositionModel {
  const result = reelCompositionSchema.safeParse(input ?? {});
  return result.success ? result.data : DEFAULT_COMPOSITION;
}

export type ReelSegmentInput = {
  startMs: number;
  endMs: number;
};

/**
 * Props passed to <ReelComposition> by both the Player and the renderer.
 * Declared as a `type` (not `interface`) so it satisfies Remotion's
 * `Record<string, unknown>` props constraint.
 */
export type ReelInputProps = {
  /** Signed proxy URL (preview) or local master path (render). */
  videoSrc: string | null;
  fps: number;
  segments: ReelSegmentInput[];
  composition: ReelCompositionModel;
  /** Cinematic typography layers rendered on top of (or behind) the video. */
  typography: TypographyLayer[];
};

/** Total assembled clip duration in frames (>= 1). */
export function totalDurationInFrames(segments: ReelSegmentInput[], fps: number): number {
  const totalMs = segments.reduce((acc, s) => acc + Math.max(0, s.endMs - s.startMs), 0);
  return Math.max(1, Math.round((totalMs / 1000) * fps));
}
