/**
 * SUPRA V3 — renders ONE cinematic typography layer inside the composition.
 *
 * Supports the three agency fill modes:
 *   - solid       : flat editorial text (brand/off-white)
 *   - translucent : see-through text (low opacity + blend mode)
 *   - video_matte : TRUE text matte — the source footage shows *inside* the
 *                   letters via an SVG <clipPath> (works in Player + render,
 *                   both Chromium), not a flat-color fallback.
 *
 * Motion comes from the shared motion engine so preview === export.
 */
import React, { useMemo } from 'react';
import { OffthreadVideo, useCurrentFrame } from 'remotion';

import { fontFamilyFor } from './fonts';
import { computeLayerMotion } from './motion';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './schema';
import type { TypographyLayer } from './typography';

type Props = {
  layer: TypographyLayer;
  fps: number;
  durationInFrames: number;
  videoSrc: string;
  /** Source frame the matte footage should start from (assembled→source map). */
  matteTrimBefore: number;
};

function applyTransform(text: string, mode: TypographyLayer['textTransform']): string {
  if (mode === 'uppercase') return text.toUpperCase();
  if (mode === 'lowercase') return text.toLowerCase();
  return text;
}

export const TypographyLayerView: React.FC<Props> = ({
  layer,
  fps,
  durationInFrames,
  videoSrc,
  matteTrimBefore,
}) => {
  const frame = useCurrentFrame();
  const motion = computeLayerMotion(layer, frame, fps, durationInFrames);

  const fontSizePx = layer.fontSize * CANVAS_HEIGHT;
  const leftPx = layer.x * CANVAS_WIDTH;
  const topPx = layer.y * CANVAS_HEIGHT;
  const maxWidthPx = layer.maxWidth * CANVAS_WIDTH;
  const fontFamily = fontFamilyFor(layer.font);
  const letterSpacingEm = layer.letterSpacing + motion.extraTrackingEm;
  const displayText = applyTransform(layer.text, layer.textTransform);
  const opacity = Math.max(0, Math.min(1, layer.opacity * motion.opacity));

  const clipId = useMemo(
    () => `matte_${layer.id.replace(/[^a-zA-Z0-9_]/g, '')}`,
    [layer.id],
  );

  // ---- VIDEO MATTE (footage inside the letters) ----
  if (layer.fillMode === 'video_matte' && videoSrc) {
    const letterSpacingPx = letterSpacingEm * fontSizePx;
    return (
      <>
        <svg
          width={0}
          height={0}
          style={{ position: 'absolute' }}
          aria-hidden
        >
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <text
                x={leftPx}
                y={topPx}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={fontFamily}
                fontSize={fontSizePx}
                fontWeight={layer.fontWeight}
                fontStyle={layer.fontStyle}
                letterSpacing={letterSpacingPx}
              >
                {displayText}
              </text>
            </clipPath>
          </defs>
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity,
            mixBlendMode: layer.blendMode === 'normal' ? undefined : layer.blendMode,
            clipPath: `url(#${clipId})`,
            WebkitClipPath: `url(#${clipId})`,
            transform: `translate(${motion.translateX}px, ${motion.translateY}px) rotate(${layer.rotation}deg) scale(${motion.scale})`,
            transformOrigin: `${leftPx}px ${topPx}px`,
          }}
        >
          <OffthreadVideo
            src={videoSrc}
            trimBefore={matteTrimBefore}
            durationInFrames={durationInFrames}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* subtle tint to seat the footage into the brand palette */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: layer.color,
              opacity: 0.12,
              mixBlendMode: 'overlay',
            }}
          />
        </div>
      </>
    );
  }

  // ---- SOLID / TRANSLUCENT (DOM text) ----
  const baseTextStyle: React.CSSProperties = {
    margin: 0,
    fontFamily,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle,
    fontSize: fontSizePx,
    lineHeight: layer.lineHeight,
    letterSpacing: `${letterSpacingEm}em`,
    color: layer.color,
    textAlign: layer.align,
    textTransform: 'none',
    whiteSpace: 'pre-wrap',
    WebkitFontSmoothing: 'antialiased',
  };

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: leftPx,
    top: topPx,
    width: maxWidthPx,
    opacity,
    mixBlendMode: layer.blendMode === 'normal' ? undefined : layer.blendMode,
    transform: `translate(-50%, -50%) translate(${motion.translateX}px, ${motion.translateY}px) rotate(${layer.rotation}deg) scale(${motion.scale})`,
    transformOrigin: 'center center',
    pointerEvents: 'none',
  };

  // Word-by-word entrance
  if (layer.animIn === 'word_by_word') {
    const words = displayText.split(/(\s+)/);
    const realWordCount = words.filter((w) => w.trim().length > 0).length || 1;
    let wordIdx = -1;
    return (
      <div style={containerStyle}>
        <p style={baseTextStyle}>
          {words.map((w, i) => {
            if (w.trim().length === 0) return <span key={i}>{w}</span>;
            wordIdx += 1;
            const local = Math.max(0, Math.min(1, motion.wordReveal * realWordCount - wordIdx));
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  opacity: local,
                  transform: `translateY(${(1 - local) * 0.35}em)`,
                }}
              >
                {w}
              </span>
            );
          })}
        </p>
      </div>
    );
  }

  // Mask wipe entrance (left → right reveal)
  const innerClip =
    layer.animIn === 'mask_wipe'
      ? { clipPath: `inset(0 ${(1 - motion.wipe) * 100}% 0 0)` }
      : undefined;

  return (
    <div style={containerStyle}>
      <p style={{ ...baseTextStyle, ...innerClip }}>{displayText}</p>
    </div>
  );
};
