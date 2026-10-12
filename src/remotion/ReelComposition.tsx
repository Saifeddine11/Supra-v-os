/**
 * SUPRA V3 — shared Reel composition (Remotion).
 *
 * Draw order (bottom → top):
 *   1. Layer A  — blurred, dimmed, full-canvas background (muted copy of source)
 *   2. BEHIND   — typography layers with depth === 'behind'
 *   3. Layer B  — the complete, untouched source video (contained, carries audio)
 *   4. FRONT    — typography layers with depth === 'front'
 *
 * The same component powers the editor preview (@remotion/player) and the
 * server render (@remotion/renderer) so preview and export stay identical.
 */
import React, { useMemo } from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence } from 'remotion';

import { CANVAS_HEIGHT, type ReelInputProps } from './schema';
import { TypographyLayerView } from './TypographyLayerView';
import type { TypographyLayer } from './typography';

type Part = { from: number; durationInFrames: number; trimBefore: number };

/** Map an assembled-timeline frame back to the matching SOURCE frame. */
function sourceFrameAt(parts: Part[], assembledFrame: number): number {
  for (const p of parts) {
    if (assembledFrame < p.from + p.durationInFrames) {
      return p.trimBefore + Math.max(0, assembledFrame - p.from);
    }
  }
  const last = parts[parts.length - 1];
  return last ? last.trimBefore + last.durationInFrames : 0;
}

export const ReelComposition: React.FC<ReelInputProps> = ({
  videoSrc,
  fps,
  segments,
  composition,
  typography,
}) => {
  const parts = useMemo<Part[]>(() => {
    let acc = 0;
    return segments.map((seg) => {
      const durationInFrames = Math.max(
        1,
        Math.round((Math.max(0, seg.endMs - seg.startMs) / 1000) * fps),
      );
      const from = acc;
      acc += durationInFrames;
      return {
        from,
        durationInFrames,
        trimBefore: Math.max(0, Math.round((seg.startMs / 1000) * fps)),
      };
    });
  }, [segments, fps]);

  const layers = typography ?? [];
  const behind = useMemo(() => layers.filter((l) => l.depth === 'behind'), [layers]);
  const front = useMemo(() => layers.filter((l) => l.depth !== 'behind'), [layers]);

  if (!videoSrc) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#080706',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 40,
        }}
      >
        Proxy indisponible
      </AbsoluteFill>
    );
  }

  const { background, foreground } = composition;
  const offsetPx = foreground.offsetY * CANVAS_HEIGHT;

  const renderTypography = (list: TypographyLayer[]) =>
    list.map((layer) => {
      const from = Math.max(0, Math.round((layer.startMs / 1000) * fps));
      const durationInFrames = Math.max(1, Math.round((layer.durationMs / 1000) * fps));
      const matteTrimBefore = sourceFrameAt(parts, from);
      return (
        <Sequence key={layer.id} from={from} durationInFrames={durationInFrames}>
          <TypographyLayerView
            layer={layer}
            fps={fps}
            durationInFrames={durationInFrames}
            videoSrc={videoSrc}
            matteTrimBefore={matteTrimBefore}
          />
        </Sequence>
      );
    });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* 1 — blurred background (cover, muted) */}
      {parts.map((part, i) => (
        <Sequence key={`bg-${i}`} from={part.from} durationInFrames={part.durationInFrames}>
          <AbsoluteFill>
            <OffthreadVideo
              src={videoSrc}
              trimBefore={part.trimBefore}
              durationInFrames={part.durationInFrames}
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scale(1.12)',
                filter: `blur(${background.blur}px)`,
              }}
            />
            {background.dim > 0 ? (
              <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${background.dim})` }} />
            ) : null}
          </AbsoluteFill>
        </Sequence>
      ))}

      {/* 2 — typography behind the subject */}
      {renderTypography(behind)}

      {/* 3 — complete source video (contain, sharp, carries audio) */}
      {parts.map((part, i) => (
        <Sequence key={`fg-${i}`} from={part.from} durationInFrames={part.durationInFrames}>
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
            <OffthreadVideo
              src={videoSrc}
              trimBefore={part.trimBefore}
              durationInFrames={part.durationInFrames}
              style={{
                width: `${foreground.scale * 100}%`,
                height: `${foreground.scale * 100}%`,
                objectFit: 'contain',
                transform: `translateY(${offsetPx}px)`,
              }}
            />
          </AbsoluteFill>
        </Sequence>
      ))}

      {/* 4 — typography in front */}
      {renderTypography(front)}
    </AbsoluteFill>
  );
};
