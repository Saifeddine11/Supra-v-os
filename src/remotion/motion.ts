/**
 * SUPRA V3 — Motion engine for typography layers.
 *
 * Controlled, cinematic easing only (no cartoonish bounce). Given a layer and
 * the current frame, returns a flat set of animated values the composition
 * applies. The exact same math runs in the Player preview and the server
 * render, so motion is identical in preview and export.
 */
import { Easing, interpolate } from 'remotion';

import { CANVAS_HEIGHT, CANVAS_WIDTH } from './schema';
import type { TypographyLayer } from './typography';

export type LayerMotion = {
  /** Combined entrance × exit opacity (before the layer's own opacity). */
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  /** Extra tracking in em added during a tracking reveal. */
  extraTrackingEm: number;
  /** Horizontal wipe reveal, 0 (hidden) → 1 (fully visible). */
  wipe: number;
  /** Fraction of words revealed for word-by-word entrances, 0 → 1. */
  wordReveal: number;
};

const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN = Easing.in(Easing.cubic);

/**
 * @param localFrame frame index relative to the layer's own start (0 = first)
 * @param durationInFrames the layer's total on-screen duration in frames
 */
export function computeLayerMotion(
  layer: TypographyLayer,
  localFrame: number,
  fps: number,
  durationInFrames: number,
): LayerMotion {
  const animFrames = Math.max(1, Math.round((layer.animDurationMs / 1000) * fps));

  // Entrance progress (0 → 1 over the first animFrames)
  const pIn = interpolate(localFrame, [0, animFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });

  // Exit progress (0 → 1 over the last animFrames)
  const exitStart = Math.max(0, durationInFrames - animFrames);
  const pOut = interpolate(localFrame, [exitStart, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_IN,
  });

  const m: LayerMotion = {
    opacity: 1,
    translateX: 0,
    translateY: 0,
    scale: 1,
    extraTrackingEm: 0,
    wipe: 1,
    wordReveal: 1,
  };

  const slideY = 0.07 * CANVAS_HEIGHT;
  const slideX = 0.1 * CANVAS_WIDTH;

  // --- Entrance ---
  switch (layer.animIn) {
    case 'none':
      break;
    case 'fade':
      m.opacity *= pIn;
      break;
    case 'slide_up':
      m.opacity *= pIn;
      m.translateY += (1 - pIn) * slideY;
      break;
    case 'slide_down':
      m.opacity *= pIn;
      m.translateY -= (1 - pIn) * slideY;
      break;
    case 'slide_left':
      m.opacity *= pIn;
      m.translateX += (1 - pIn) * slideX;
      break;
    case 'slide_right':
      m.opacity *= pIn;
      m.translateX -= (1 - pIn) * slideX;
      break;
    case 'scale_in':
      m.opacity *= pIn;
      m.scale *= 0.86 + 0.14 * pIn;
      break;
    case 'tracking_in':
      m.opacity *= Math.min(1, pIn * 1.2);
      m.extraTrackingEm += (1 - pIn) * 0.32;
      break;
    case 'mask_wipe':
      m.wipe = pIn;
      break;
    case 'word_by_word':
      m.wordReveal = pIn;
      break;
    default:
      m.opacity *= pIn;
  }

  // --- Exit ---
  if (pOut > 0) {
    switch (layer.animOut) {
      case 'none':
        break;
      case 'fade':
        m.opacity *= 1 - pOut;
        break;
      case 'slide_up':
        m.opacity *= 1 - pOut;
        m.translateY -= pOut * slideY;
        break;
      case 'slide_down':
        m.opacity *= 1 - pOut;
        m.translateY += pOut * slideY;
        break;
      case 'scale_out':
        m.opacity *= 1 - pOut;
        m.scale *= 1 + 0.08 * pOut;
        break;
      default:
        m.opacity *= 1 - pOut;
    }
  }

  return m;
}
