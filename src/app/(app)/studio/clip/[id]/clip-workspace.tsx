'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Player, type PlayerRef } from '@remotion/player';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Loader2,
  MessageSquarePlus,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Scissors,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { msToTimecode, timecodeToMs, humanDuration } from '@/lib/studio/time';
import { SUBTITLE_PRESETS, subtitlePresetConfig } from '@/lib/studio/constants';
import { ReelComposition } from '@/remotion/ReelComposition';
import { FONT_OPTIONS } from '@/remotion/fonts';
import { CINEMATIC_PRESETS } from '@/remotion/presets';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_COMPOSITION,
  totalDurationInFrames,
  type ReelCompositionModel,
} from '@/remotion/schema';
import {
  ANIM_IN,
  ANIM_OUT,
  BLEND_MODES,
  createBlankLayer,
  FILL_MODES,
  type FillMode,
  type TypographyLayer,
} from '@/remotion/typography';
import type {
  BrandKit,
  Clip,
  ClipComment,
  ClipSegment,
  Export,
  RenderStatus,
  SubtitleCue,
  SubtitleStyleConfig,
} from '@/types/studio';
import {
  addCommentAction,
  requestRenderAction,
  resolveCommentAction,
  saveSegmentsAction,
  saveSubtitlesAction,
  setClipStatusAction,
  updateClipAction,
} from '../../actions';
import { ClipStatusPill } from '../../studio-status-pill';

type SubtitleStyleKey = keyof typeof SUBTITLE_PRESETS;

interface LocalSeg {
  startMs: number;
  endMs: number;
}
interface LocalCue {
  start_ms: number;
  end_ms: number;
  text: string;
}

export interface ClipWorkspaceProps {
  clip: Clip;
  sourceDurationMs: number;
  sourceFps: number;
  proxyUrl: string | null;
  segments: ClipSegment[];
  trackId: string | null;
  initialStyle: SubtitleStyleKey;
  initialCues: SubtitleCue[];
  comments: ClipComment[];
  commentAuthors: Record<string, string>;
  brandKits: BrandKit[];
  exports: Export[];
  latestRender: { status: RenderStatus; progress: number } | null;
  canWrite: boolean;
}

const selectClass =
  'h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

// On-screen size of the 9:16 composed preview.
const PREVIEW_W = 300;
const PREVIEW_H = Math.round((PREVIEW_W * CANVAS_HEIGHT) / CANVAS_WIDTH); // 533

export function ClipWorkspace(props: ClipWorkspaceProps) {
  const router = useRouter();
  const fps = Math.max(1, Math.round(props.sourceFps || 30));

  // Source trimmer video (used only for finding in/out points).
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  // Composed 9:16 preview (Remotion).
  const playerRef = useRef<PlayerRef>(null);

  const [title, setTitle] = useState(props.clip.title);
  const [segments, setSegments] = useState<LocalSeg[]>(
    [...props.segments]
      .sort((a, b) => a.idx - b.idx)
      .map((s) => ({ startMs: s.source_start_ms, endMs: s.source_end_ms })),
  );
  const [activeSeg, setActiveSeg] = useState(0);
  const [composition, setComposition] = useState<ReelCompositionModel>(
    props.clip.composition ?? DEFAULT_COMPOSITION,
  );
  const [style, setStyle] = useState<SubtitleStyleKey>(props.initialStyle);
  const [cues, setCues] = useState<LocalCue[]>(
    props.initialCues.map((c) => ({ start_ms: c.start_ms, end_ms: c.end_ms, text: c.text })),
  );
  const [brandKitId, setBrandKitId] = useState<string | null>(props.clip.brand_kit_id);

  // ─── Cinematic typography layers (+ undo/redo) ────────────────────────────
  const [typography, setTypography] = useState<TypographyLayer[]>(props.clip.typography ?? []);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    props.clip.typography?.[0]?.id ?? null,
  );
  const typoRef = useRef<TypographyLayer[]>(typography);
  const historyRef = useRef<{ past: TypographyLayer[][]; future: TypographyLayer[][] }>({
    past: [],
    future: [],
  });
  useEffect(() => {
    typoRef.current = typography;
  }, [typography]);

  const pushHistory = useCallback(() => {
    historyRef.current.past.push(typoRef.current);
    if (historyRef.current.past.length > 80) historyRef.current.past.shift();
    historyRef.current.future = [];
  }, []);
  const undo = useCallback(() => {
    const prev = historyRef.current.past.pop();
    if (prev === undefined) return;
    historyRef.current.future.push(typoRef.current);
    setTypography(prev);
  }, []);
  const redo = useCallback(() => {
    const next = historyRef.current.future.pop();
    if (next === undefined) return;
    historyRef.current.past.push(typoRef.current);
    setTypography(next);
  }, []);

  /** Live update (no history snapshot) — use during drag / slider moves. */
  const patchLayerLive = useCallback((id: string, patch: Partial<TypographyLayer>) => {
    setTypography((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const selectedLayer = useMemo(
    () => typography.find((l) => l.id === selectedLayerId) ?? null,
    [typography, selectedLayerId],
  );

  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sourceMs, setSourceMs] = useState(segments[0]?.startMs ?? 0);
  const [clipMs, setClipMs] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => setMounted(true), []);

  const styleConfig: SubtitleStyleConfig = useMemo(() => subtitlePresetConfig(style), [style]);

  // ─── Clip timeline math ──────────────────────────────────────────────────
  const totalMs = useMemo(
    () => segments.reduce((a, s) => a + Math.max(0, s.endMs - s.startMs), 0),
    [segments],
  );
  const durationInFrames = useMemo(
    () => totalDurationInFrames(segments, fps),
    [segments, fps],
  );
  const msToFrame = useCallback((ms: number) => Math.round((ms / 1000) * fps), [fps]);
  const frameToMs = useCallback((f: number) => Math.round((f / fps) * 1000), [fps]);

  const inputProps = useMemo(
    () => ({
      videoSrc: props.proxyUrl,
      fps,
      segments: segments.map((s) => ({ startMs: s.startMs, endMs: s.endMs })),
      composition,
      typography,
    }),
    [props.proxyUrl, fps, segments, composition, typography],
  );

  // ─── Composed preview playback (Remotion Player) ─────────────────────────
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setClipMs(frameToMs(e.detail.frame));
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    p.addEventListener('ended', onPause);
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
      p.removeEventListener('ended', onPause);
    };
  }, [mounted, frameToMs]);

  const togglePlay = () => playerRef.current?.toggle();

  const seekClip = useCallback(
    (clip: number) => {
      const ms = Math.max(0, Math.min(clip, totalMs));
      playerRef.current?.seekTo(msToFrame(ms));
      setClipMs(ms);
    },
    [totalMs, msToFrame],
  );

  // ─── Source trimmer ──────────────────────────────────────────────────────
  const seekSource = useCallback((srcMs: number) => {
    const video = sourceVideoRef.current;
    if (video) video.currentTime = srcMs / 1000;
    setSourceMs(srcMs);
  }, []);

  // ─── Active subtitle cue (preview overlay) ───────────────────────────────
  const activeCue = useMemo(
    () => cues.find((c) => clipMs >= c.start_ms && clipMs < c.end_ms) ?? null,
    [cues, clipMs],
  );

  // ─── Segment editing ─────────────────────────────────────────────────────
  const updateSeg = (idx: number, patch: Partial<LocalSeg>) => {
    setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const addSegment = () => {
    const start = Math.round(sourceMs);
    const end = Math.min(props.sourceDurationMs, start + 5000);
    setSegments((prev) => [...prev, { startMs: start, endMs: end }]);
  };
  const removeSegment = (idx: number) => {
    setSegments((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
    setActiveSeg(0);
  };

  // ─── Typography layer actions (history-tracked) ───────────────────────────
  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = CINEMATIC_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const layers = preset.build({ startMs: Math.round(clipMs) });
      pushHistory();
      setTypography((prev) => [...prev, ...layers]);
      setSelectedLayerId(layers[0]?.id ?? null);
    },
    [clipMs, pushHistory],
  );
  const addBlankLayer = useCallback(() => {
    const layer = createBlankLayer({ startMs: Math.round(clipMs), durationMs: 3000 });
    pushHistory();
    setTypography((prev) => [...prev, layer]);
    setSelectedLayerId(layer.id);
  }, [clipMs, pushHistory]);
  const deleteLayer = useCallback(
    (id: string) => {
      pushHistory();
      setTypography((prev) => prev.filter((l) => l.id !== id));
      setSelectedLayerId((cur) => (cur === id ? null : cur));
    },
    [pushHistory],
  );
  const duplicateLayer = useCallback(
    (id: string) => {
      const src = typoRef.current.find((l) => l.id === id);
      if (!src) return;
      const { id: _omitId, ...rest } = src;
      void _omitId;
      const copy = createBlankLayer({ ...rest, x: Math.min(1, src.x + 0.04), y: Math.min(1, src.y + 0.04) });
      pushHistory();
      setTypography((prev) => [...prev, copy]);
      setSelectedLayerId(copy.id);
    },
    [pushHistory],
  );
  const moveLayer = useCallback(
    (id: string, dir: -1 | 1) => {
      pushHistory();
      setTypography((prev) => {
        const idx = prev.findIndex((l) => l.id === id);
        const to = idx + dir;
        if (idx < 0 || to < 0 || to >= prev.length) return prev;
        const next = [...prev];
        const [item] = next.splice(idx, 1);
        next.splice(to, 0, item);
        return next;
      });
    },
    [pushHistory],
  );
  /** Discrete property change (snapshots history once). */
  const patchLayer = useCallback(
    (id: string, patch: Partial<TypographyLayer>) => {
      pushHistory();
      patchLayerLive(id, patch);
    },
    [pushHistory, patchLayerLive],
  );

  // Keyboard undo / redo (scoped so we don't hijack form typing)
  useEffect(() => {
    if (!props.canWrite) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.canWrite, undo, redo]);

  // ─── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (segments.some((s) => s.endMs <= s.startMs)) {
      toast.error('Chaque segment doit avoir une fin après son début.');
      return;
    }
    setSaving(true);
    try {
      const seg = await saveSegmentsAction({
        clipId: props.clip.id,
        ranges: segments.map((s) => ({ startMs: Math.round(s.startMs), endMs: Math.round(s.endMs) })),
      });
      if (!seg.ok) throw new Error(seg.error);

      const upd = await updateClipAction({
        clipId: props.clip.id,
        title: title.trim() || props.clip.title,
        composition,
        typography,
        subtitleStyle: style,
        brandKitId,
      });
      if (!upd.ok) throw new Error(upd.error);

      if (props.trackId) {
        const subs = await saveSubtitlesAction({
          clipId: props.clip.id,
          trackId: props.trackId,
          cues: cues.map((c) => ({
            start_ms: Math.round(c.start_ms),
            end_ms: Math.round(c.end_ms),
            text: c.text,
            words: [],
          })),
          style,
          styleConfig: styleConfig as unknown as Record<string, unknown>,
        });
        if (!subs.ok) throw new Error(subs.error);
      }

      toast.success('Clip enregistré.');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  const setBg = (patch: Partial<ReelCompositionModel['background']>) =>
    setComposition((c) => ({ ...c, background: { ...c.background, ...patch } }));
  const setFg = (patch: Partial<ReelCompositionModel['foreground']>) =>
    setComposition((c) => ({ ...c, foreground: { ...c.foreground, ...patch } }));

  const captionBottomPct = styleConfig.position === 'bottom' ? 14 : undefined;
  const captionTopPct = styleConfig.position === 'top' ? 10 : undefined;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0a09] text-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!props.canWrite}
            className="h-9 w-64 border-white/10 bg-white/5 text-white"
          />
          <ClipStatusPill status={props.clip.status} />
          <span className="text-xs text-white/50">{humanDuration(totalMs)}</span>
        </div>
        {props.canWrite ? (
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[320px_1fr_300px]">
        {/* ─── Left: composition + subtitles style ─── */}
        <div className="space-y-5">
          <Panel title="Composition 9:16">
            <p className="mb-3 text-[11px] leading-relaxed text-white/40">
              La vidéo source est affichée entière (sans recadrage) sur un fond flou animé.
            </p>
            <Slider
              label="Flou de l'arrière-plan"
              value={composition.background.blur}
              min={0}
              max={120}
              step={1}
              fmt={(v) => `${Math.round(v)} px`}
              onChange={(v) => setBg({ blur: v })}
              disabled={!props.canWrite}
            />
            <Slider
              label="Assombrissement du fond"
              value={composition.background.dim}
              min={0}
              max={0.8}
              step={0.01}
              fmt={(v) => `${Math.round(v * 100)} %`}
              onChange={(v) => setBg({ dim: v })}
              disabled={!props.canWrite}
            />
            <Slider
              label="Position verticale"
              value={composition.foreground.offsetY}
              min={-0.4}
              max={0.4}
              step={0.005}
              fmt={(v) => (v === 0 ? 'Centré' : `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`)}
              onChange={(v) => setFg({ offsetY: v })}
              disabled={!props.canWrite}
            />
            <Slider
              label="Taille de la vidéo"
              value={composition.foreground.scale}
              min={0.5}
              max={1}
              step={0.01}
              fmt={(v) => `${Math.round(v * 100)} %`}
              onChange={(v) => setFg({ scale: v })}
              disabled={!props.canWrite}
            />
          </Panel>

          <Panel title="Sous-titres">
            <label className="mb-1 block text-xs text-white/60">Style</label>
            <select
              className={cn(selectClass, 'w-full')}
              value={style}
              onChange={(e) => setStyle(e.target.value as SubtitleStyleKey)}
              disabled={!props.canWrite}
            >
              {(Object.keys(SUBTITLE_PRESETS) as SubtitleStyleKey[]).map((k) => (
                <option key={k} value={k}>
                  {SUBTITLE_PRESETS[k].label}
                </option>
              ))}
            </select>

            {props.brandKits.length > 0 ? (
              <>
                <label className="mb-1 mt-3 block text-xs text-white/60">Brand Kit</label>
                <select
                  className={cn(selectClass, 'w-full')}
                  value={brandKitId ?? ''}
                  onChange={(e) => setBrandKitId(e.target.value || null)}
                  disabled={!props.canWrite}
                >
                  <option value="">Aucun</option>
                  {props.brandKits.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </Panel>

          <TypographyPanel
            layers={typography}
            selectedId={selectedLayerId}
            canWrite={props.canWrite}
            onApplyPreset={applyPreset}
            onAddBlank={addBlankLayer}
            onSelect={setSelectedLayerId}
            onDelete={deleteLayer}
            onDuplicate={duplicateLayer}
            onMove={moveLayer}
            onUndo={undo}
            onRedo={redo}
          />
        </div>

        {/* ─── Center: composed preview + source trimmer ─── */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative overflow-hidden rounded-xl bg-black"
            style={{ width: PREVIEW_W, height: PREVIEW_H }}
          >
            {mounted && props.proxyUrl ? (
              <Player
                ref={playerRef}
                component={ReelComposition}
                inputProps={inputProps}
                durationInFrames={durationInFrames}
                fps={fps}
                compositionWidth={CANVAS_WIDTH}
                compositionHeight={CANVAS_HEIGHT}
                style={{ width: PREVIEW_W, height: PREVIEW_H }}
                acknowledgeRemotionLicense
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-white/40">
                {props.proxyUrl ? 'Chargement…' : 'Proxy indisponible'}
              </div>
            )}

            {/* Caption overlay (burned by the renderer at export) */}
            {activeCue ? (
              <div
                className="pointer-events-none absolute inset-x-0 flex justify-center px-4"
                style={{
                  bottom: captionBottomPct ? `${captionBottomPct}%` : undefined,
                  top: captionTopPct ? `${captionTopPct}%` : undefined,
                  ...(styleConfig.position === 'center'
                    ? { top: '50%', transform: 'translateY(-50%)' }
                    : {}),
                }}
              >
                <span
                  className="text-center leading-tight"
                  style={{
                    fontWeight: styleConfig.fontWeight,
                    fontSize: Math.round((styleConfig.fontSize ?? 52) / 4),
                    color: styleConfig.color,
                    textShadow: `0 0 ${styleConfig.outlineWidth ?? 2}px ${styleConfig.outlineColor}, 0 1px 2px #000`,
                    textTransform: styleConfig.uppercase ? 'uppercase' : 'none',
                    maxWidth: `${styleConfig.maxWidthPct ?? 86}%`,
                  }}
                >
                  {activeCue.text}
                </span>
              </div>
            ) : null}

            {/* Typography drag handles (map preview px → normalized canvas) */}
            {mounted && props.proxyUrl ? (
              <TypographyDragLayer
                layers={typography}
                selectedId={selectedLayerId}
                canWrite={props.canWrite}
                onSelect={setSelectedLayerId}
                onDragStart={pushHistory}
                onDragMove={(id, x, y) => patchLayerLive(id, { x, y })}
              />
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={togglePlay}
              className="border-white/15 bg-white/5 text-white"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <span className="font-mono text-sm text-white/70">
              {msToTimecode(clipMs)} / {msToTimecode(totalMs)}
            </span>
          </div>

          {/* Composed clip scrubber */}
          <ClipScrubber totalMs={totalMs} playheadMs={clipMs} onSeek={seekClip} />

          {/* Source trimmer */}
          <div className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
              Découpage source
            </p>
            {props.proxyUrl ? (
              <video
                ref={sourceVideoRef}
                src={props.proxyUrl}
                className="mb-2 w-full rounded-lg bg-black"
                style={{ aspectRatio: '16 / 9' }}
                playsInline
                onTimeUpdate={(e) => setSourceMs(e.currentTarget.currentTime * 1000)}
                onLoadedMetadata={() => {
                  const v = sourceVideoRef.current;
                  if (v) v.currentTime = (segments[0]?.startMs ?? 0) / 1000;
                }}
              />
            ) : null}
            <div className="mb-2 flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const v = sourceVideoRef.current;
                  if (!v) return;
                  if (v.paused) void v.play();
                  else v.pause();
                }}
                className="h-8 w-8 border-white/15 bg-white/5 text-white"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
              <span className="font-mono text-xs text-white/60">
                {msToTimecode(sourceMs)} / {msToTimecode(props.sourceDurationMs)}
              </span>
            </div>

            <SourceTimeline
              durationMs={props.sourceDurationMs}
              segments={segments}
              playheadMs={sourceMs}
              activeSeg={activeSeg}
              onSeek={seekSource}
              onSelectSeg={setActiveSeg}
            />

            <div className="mt-2 space-y-2">
              {segments.map((s, i) => (
                <SegmentRow
                  key={i}
                  index={i}
                  seg={s}
                  active={i === activeSeg}
                  canWrite={props.canWrite}
                  durationMs={props.sourceDurationMs}
                  onSelect={() => setActiveSeg(i)}
                  onChange={(patch) => updateSeg(i, patch)}
                  onSetStart={() => updateSeg(i, { startMs: Math.round(sourceMs) })}
                  onSetEnd={() => updateSeg(i, { endMs: Math.round(sourceMs) })}
                  onRemove={() => removeSegment(i)}
                  removable={segments.length > 1}
                />
              ))}
              {props.canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addSegment}
                  className="text-white/70 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Ajouter une plage
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* ─── Right: review + export ─── */}
        <div className="space-y-5">
          <ReviewPanel
            clipId={props.clip.id}
            status={props.clip.status}
            comments={props.comments}
            authors={props.commentAuthors}
            canWrite={props.canWrite}
            currentClipMs={clipMs}
            onSeek={seekClip}
          />
          <SubtitleEditor
            cues={cues}
            setCues={setCues}
            canWrite={props.canWrite}
            onSeek={(ms) => seekClip(ms)}
          />
          <ExportPanel
            clipId={props.clip.id}
            canWrite={props.canWrite}
            exports={props.exports}
            latestRender={props.latestRender}
          />
        </div>
      </div>

      {/* ─── Typography inspector (selected layer) ─── */}
      {selectedLayer ? (
        <TypographyInspector
          key={selectedLayer.id}
          layer={selectedLayer}
          canWrite={props.canWrite}
          totalMs={totalMs}
          onPatch={(patch) => patchLayer(selectedLayer.id, patch)}
          onPatchLive={(patch) => patchLayerLive(selectedLayer.id, patch)}
          onBeginContinuous={pushHistory}
        />
      ) : null}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">{title}</p>
      {children}
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, disabled, fmt,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; disabled?: boolean; fmt?: (v: number) => string;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex justify-between text-xs text-white/60">
        <span>{label}</span>
        <span className="font-mono">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#FF3D0A]"
      />
    </div>
  );
}

function ClipScrubber({
  totalMs, playheadMs, onSeek,
}: {
  totalMs: number;
  playheadMs: number;
  onSeek: (ms: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dur = totalMs || 1;
  return (
    <div
      ref={ref}
      onClick={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        onSeek(Math.max(0, Math.min(1, pct)) * dur);
      }}
      className="relative h-2.5 w-full cursor-pointer overflow-hidden rounded-full border border-white/10 bg-white/[0.05]"
      style={{ width: PREVIEW_W }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-[#FF3D0A]/60"
        style={{ width: `${(playheadMs / dur) * 100}%` }}
      />
    </div>
  );
}

function SourceTimeline({
  durationMs, segments, playheadMs, activeSeg, onSeek, onSelectSeg,
}: {
  durationMs: number;
  segments: LocalSeg[];
  playheadMs: number;
  activeSeg: number;
  onSeek: (ms: number) => void;
  onSelectSeg: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dur = durationMs || 1;
  const handleClick = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, pct)) * dur);
  };
  return (
    <div
      ref={ref}
      onClick={handleClick}
      className="relative h-12 w-full cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]"
    >
      {segments.map((s, i) => (
        <div
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            onSelectSeg(i);
          }}
          className={cn(
            'absolute top-1 bottom-1 rounded border',
            i === activeSeg ? 'border-[#FF3D0A] bg-[#FF3D0A]/25' : 'border-white/20 bg-white/10',
          )}
          style={{ left: `${(s.startMs / dur) * 100}%`, width: `${((s.endMs - s.startMs) / dur) * 100}%` }}
          title={`${msToTimecode(s.startMs)} → ${msToTimecode(s.endMs)}`}
        />
      ))}
      <div
        className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-white"
        style={{ left: `${(playheadMs / dur) * 100}%` }}
      />
    </div>
  );
}

function SegmentRow({
  index, seg, active, canWrite, durationMs, onSelect, onChange, onSetStart, onSetEnd, onRemove, removable,
}: {
  index: number;
  seg: LocalSeg;
  active: boolean;
  canWrite: boolean;
  durationMs: number;
  onSelect: () => void;
  onChange: (patch: Partial<LocalSeg>) => void;
  onSetStart: () => void;
  onSetEnd: () => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const [start, setStart] = useState(msToTimecode(seg.startMs));
  const [end, setEnd] = useState(msToTimecode(seg.endMs));
  useEffect(() => setStart(msToTimecode(seg.startMs)), [seg.startMs]);
  useEffect(() => setEnd(msToTimecode(seg.endMs)), [seg.endMs]);

  const commit = (which: 'start' | 'end', raw: string) => {
    const ms = timecodeToMs(raw);
    if (ms == null) return;
    const clamped = Math.max(0, Math.min(ms, durationMs));
    onChange(which === 'start' ? { startMs: clamped } : { endMs: clamped });
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-2 py-1.5',
        active ? 'border-[#FF3D0A]/60 bg-[#FF3D0A]/10' : 'border-white/10 bg-white/[0.03]',
      )}
    >
      <Scissors className="h-3.5 w-3.5 text-white/40" />
      <span className="w-5 text-xs text-white/50">{index + 1}</span>
      <input
        value={start}
        disabled={!canWrite}
        onChange={(e) => setStart(e.target.value)}
        onBlur={() => commit('start', start)}
        className="h-7 w-20 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-xs text-white"
      />
      <span className="text-white/30">→</span>
      <input
        value={end}
        disabled={!canWrite}
        onChange={(e) => setEnd(e.target.value)}
        onBlur={() => commit('end', end)}
        className="h-7 w-20 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-xs text-white"
      />
      {canWrite ? (
        <div className="ml-auto flex items-center gap-1">
          <button onClick={onSetStart} title="Début = tête de lecture source" className="rounded px-1 text-[10px] text-white/50 hover:text-white">
            ⇤
          </button>
          <button onClick={onSetEnd} title="Fin = tête de lecture source" className="rounded px-1 text-[10px] text-white/50 hover:text-white">
            ⇥
          </button>
          {removable ? (
            <button onClick={onRemove} className="rounded p-0.5 text-white/40 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReviewPanel({
  clipId, status, comments, authors, canWrite, currentClipMs, onSeek,
}: {
  clipId: string;
  status: Clip['status'];
  comments: ClipComment[];
  authors: Record<string, string>;
  canWrite: boolean;
  currentClipMs: number;
  onSeek: (ms: number) => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function changeStatus(next: Clip['status']) {
    setBusy(true);
    const res = await setClipStatusAction(clipId, next);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success('Statut mis à jour.');
    router.refresh();
  }

  async function addComment() {
    if (!body.trim()) return;
    setBusy(true);
    const res = await addCommentAction({
      clipId,
      timestampMs: Math.round(currentClipMs),
      body: body.trim(),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setBody('');
    router.refresh();
  }

  async function toggleResolved(c: ClipComment) {
    const res = await resolveCommentAction(c.id, clipId, !c.resolved);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  return (
    <Panel title="Relecture">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {status !== 'needs_review' ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus('needs_review')} className="border-white/15 bg-white/5 text-white">
            À relire
          </Button>
        ) : null}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus('changes_requested')} className="border-white/15 bg-white/5 text-white">
          Corrections
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => changeStatus('approved')}>
          Valider
        </Button>
      </div>

      <div className="max-h-48 space-y-2 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-xs text-white/40">Aucun commentaire.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className={cn('rounded-lg border border-white/10 bg-white/[0.03] p-2', c.resolved && 'opacity-50')}>
              <div className="flex items-center gap-2">
                {c.timestamp_ms != null ? (
                  <button
                    onClick={() => onSeek(c.timestamp_ms ?? 0)}
                    className="font-mono text-xs text-[#FF6A2A] hover:underline"
                  >
                    {msToTimecode(c.timestamp_ms)}
                  </button>
                ) : null}
                <span className="text-[10px] text-white/40">
                  {c.author_employee_id ? authors[c.author_employee_id] ?? 'Équipe' : 'Équipe'}
                </span>
                <button onClick={() => toggleResolved(c)} className="ml-auto text-[10px] text-white/40 hover:text-white">
                  {c.resolved ? 'Rouvrir' : 'Résoudre'}
                </button>
              </div>
              <p className="mt-1 text-xs text-white/85">{c.body}</p>
            </div>
          ))
        )}
      </div>

      {canWrite ? (
        <div className="mt-3 space-y-2">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Commentaire à ${msToTimecode(currentClipMs)}…`}
            className="h-9 border-white/10 bg-white/5 text-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addComment();
            }}
          />
          <Button size="sm" variant="outline" disabled={busy} onClick={addComment} className="w-full border-white/15 bg-white/5 text-white">
            <MessageSquarePlus className="h-3.5 w-3.5" /> Commenter à la tête de lecture
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

function SubtitleEditor({
  cues, setCues, canWrite, onSeek,
}: {
  cues: LocalCue[];
  setCues: React.Dispatch<React.SetStateAction<LocalCue[]>>;
  canWrite: boolean;
  onSeek: (ms: number) => void;
}) {
  return (
    <Panel title={`Sous-titres (${cues.length})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {cues.length === 0 ? (
          <p className="text-xs text-white/40">Aucun sous-titre.</p>
        ) : (
          cues.map((c, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <button
                onClick={() => onSeek(c.start_ms)}
                className="mb-1 font-mono text-[10px] text-[#FF6A2A] hover:underline"
              >
                {msToTimecode(c.start_ms)} → {msToTimecode(c.end_ms)}
              </button>
              <textarea
                value={c.text}
                disabled={!canWrite}
                rows={2}
                onChange={(e) =>
                  setCues((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                }
                className="w-full resize-none rounded border border-white/10 bg-white/5 p-1.5 text-xs text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              />
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function fillModeLabel(m: FillMode): string {
  if (m === 'video_matte') return 'Texture vidéo';
  if (m === 'translucent') return 'Translucide';
  return 'Plein';
}

// ─── Typography: drag handles over the preview ───────────────────────────────
function TypographyDragLayer({
  layers, selectedId, canWrite, onSelect, onDragStart, onDragMove,
}: {
  layers: TypographyLayer[];
  selectedId: string | null;
  canWrite: boolean;
  onSelect: (id: string) => void;
  onDragStart: () => void;
  onDragMove: (id: string, x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);

  const handleMove = (e: React.PointerEvent) => {
    const id = dragId.current;
    const el = containerRef.current;
    if (!id || !el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(-0.3, Math.min(1.3, (e.clientX - rect.left) / rect.width));
    const y = Math.max(-0.3, Math.min(1.3, (e.clientY - rect.top) / rect.height));
    onDragMove(id, Number(x.toFixed(4)), Number(y.toFixed(4)));
  };

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ pointerEvents: 'none' }}>
      {layers.map((l) => {
        const selected = l.id === selectedId;
        return (
          <button
            key={l.id}
            type="button"
            title={l.text}
            onPointerDown={(e) => {
              if (!canWrite) return;
              e.preventDefault();
              e.stopPropagation();
              onSelect(l.id);
              onDragStart();
              dragId.current = l.id;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={handleMove}
            onPointerUp={() => {
              dragId.current = null;
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(l.id);
            }}
            className={cn(
              'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border',
              selected
                ? 'border-[#FF3D0A] bg-[#FF3D0A]/40 ring-2 ring-[#FF3D0A]/40'
                : 'border-white/50 bg-black/50',
            )}
            style={{
              left: `${l.x * 100}%`,
              top: `${l.y * 100}%`,
              width: 18,
              height: 18,
              pointerEvents: canWrite ? 'auto' : 'none',
              cursor: canWrite ? 'move' : 'default',
              touchAction: 'none',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </button>
        );
      })}
    </div>
  );
}

// ─── Typography: layer list + presets ────────────────────────────────────────
function TypographyPanel({
  layers, selectedId, canWrite, onApplyPreset, onAddBlank, onSelect, onDelete, onDuplicate, onMove, onUndo, onRedo,
}: {
  layers: TypographyLayer[];
  selectedId: string | null;
  canWrite: boolean;
  onApplyPreset: (id: string) => void;
  onAddBlank: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <Panel title="Typographie cinématique">
      {canWrite ? (
        <>
          <label className="mb-1 block text-xs text-white/60">Preset</label>
          <select
            className={cn(selectClass, 'w-full')}
            value=""
            onChange={(e) => {
              if (e.target.value) onApplyPreset(e.target.value);
            }}
          >
            <option value="">Appliquer un preset…</option>
            {CINEMATIC_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onAddBlank}
              className="flex-1 border-white/15 bg-white/5 text-white"
            >
              <Type className="h-3.5 w-3.5" /> Texte
            </Button>
            <Button size="icon" variant="outline" onClick={onUndo} title="Annuler (⌘Z)" className="h-9 w-9 border-white/15 bg-white/5 text-white">
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="outline" onClick={onRedo} title="Rétablir (⌘⇧Z)" className="h-9 w-9 border-white/15 bg-white/5 text-white">
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      ) : null}

      <div className="mt-3 space-y-1.5">
        {layers.length === 0 ? (
          <p className="text-xs text-white/40">
            Aucun calque de texte. Appliquez un preset ou ajoutez un texte.
          </p>
        ) : (
          layers.map((l, i) => (
            <div
              key={l.id}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2 py-1.5',
                l.id === selectedId
                  ? 'border-[#FF3D0A]/60 bg-[#FF3D0A]/10'
                  : 'border-white/10 bg-white/[0.03]',
              )}
            >
              <button onClick={() => onSelect(l.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-xs text-white/85">{l.text || '(vide)'}</span>
                <span className="block text-[10px] text-white/40">
                  {fillModeLabel(l.fillMode)} · {(l.startMs / 1000).toFixed(1)}s
                </span>
              </button>
              {canWrite ? (
                <div className="flex items-center gap-0.5">
                  <button onClick={() => onMove(l.id, -1)} disabled={i === 0} className="rounded p-0.5 text-white/40 hover:text-white disabled:opacity-20">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onMove(l.id, 1)} disabled={i === layers.length - 1} className="rounded p-0.5 text-white/40 hover:text-white disabled:opacity-20">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onDuplicate(l.id)} title="Dupliquer" className="rounded p-0.5 text-white/40 hover:text-white">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onDelete(l.id)} title="Supprimer" className="rounded p-0.5 text-white/40 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

// ─── Typography: property inspector ──────────────────────────────────────────
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

function InspField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">{label}</label>
      {children}
    </div>
  );
}

function InspRange({
  value, min, max, step, fmt, onBegin, onLive, disabled,
}: {
  value: number; min: number; max: number; step: number; fmt: (v: number) => string;
  onBegin: () => void; onLive: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onPointerDown={onBegin}
        onChange={(e) => onLive(Number(e.target.value))}
        className="w-full accent-[#FF3D0A]"
      />
      <span className="w-14 shrink-0 text-right font-mono text-[10px] text-white/50">{fmt(value)}</span>
    </div>
  );
}

function TypographyInspector({
  layer, canWrite, totalMs, onPatch, onPatchLive, onBeginContinuous,
}: {
  layer: TypographyLayer;
  canWrite: boolean;
  totalMs: number;
  onPatch: (patch: Partial<TypographyLayer>) => void;
  onPatchLive: (patch: Partial<TypographyLayer>) => void;
  onBeginContinuous: () => void;
}) {
  const disabled = !canWrite;
  const showColor = layer.fillMode !== 'video_matte';
  return (
    <div className="border-t border-white/10 p-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
        <Type className="h-3.5 w-3.5 text-[#FF6A2A]" /> Calque de texte
      </p>

      <div className="mb-3">
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">Texte</label>
        <textarea
          value={layer.text}
          disabled={disabled}
          rows={2}
          onFocus={onBeginContinuous}
          onChange={(e) => onPatchLive({ text: e.target.value })}
          className="w-full resize-none rounded border border-white/10 bg-white/5 p-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
        <InspField label="Police">
          <select className={cn(selectClass, 'w-full')} value={layer.font} disabled={disabled}
            onChange={(e) => onPatch({ font: e.target.value as TypographyLayer['font'] })}>
            {FONT_OPTIONS.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </InspField>

        <InspField label="Graisse">
          <select className={cn(selectClass, 'w-full')} value={layer.fontWeight} disabled={disabled}
            onChange={(e) => onPatch({ fontWeight: Number(e.target.value) })}>
            {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </InspField>

        <InspField label="Style">
          <select className={cn(selectClass, 'w-full')} value={layer.fontStyle} disabled={disabled}
            onChange={(e) => onPatch({ fontStyle: e.target.value as TypographyLayer['fontStyle'] })}>
            <option value="normal">Normal</option>
            <option value="italic">Italique</option>
          </select>
        </InspField>

        <InspField label="Remplissage">
          <select className={cn(selectClass, 'w-full')} value={layer.fillMode} disabled={disabled}
            onChange={(e) => onPatch({ fillMode: e.target.value as FillMode })}>
            {FILL_MODES.map((m) => <option key={m} value={m}>{fillModeLabel(m)}</option>)}
          </select>
        </InspField>

        {showColor ? (
          <InspField label="Couleur">
            <input type="color" value={layer.color} disabled={disabled}
              onFocus={onBeginContinuous}
              onChange={(e) => onPatchLive({ color: e.target.value })}
              className="h-9 w-full cursor-pointer rounded border border-white/10 bg-white/5" />
          </InspField>
        ) : null}

        <InspField label="Taille">
          <InspRange value={layer.fontSize} min={0.03} max={0.5} step={0.005}
            fmt={(v) => `${Math.round(v * CANVAS_HEIGHT)}px`} disabled={disabled}
            onBegin={onBeginContinuous} onLive={(v) => onPatchLive({ fontSize: v })} />
        </InspField>

        <InspField label="Interlettrage">
          <InspRange value={layer.letterSpacing} min={-0.05} max={0.4} step={0.005}
            fmt={(v) => `${v.toFixed(3)}em`} disabled={disabled}
            onBegin={onBeginContinuous} onLive={(v) => onPatchLive({ letterSpacing: v })} />
        </InspField>

        <InspField label="Interligne">
          <InspRange value={layer.lineHeight} min={0.8} max={1.6} step={0.02}
            fmt={(v) => v.toFixed(2)} disabled={disabled}
            onBegin={onBeginContinuous} onLive={(v) => onPatchLive({ lineHeight: v })} />
        </InspField>

        <InspField label="Casse">
          <select className={cn(selectClass, 'w-full')} value={layer.textTransform} disabled={disabled}
            onChange={(e) => onPatch({ textTransform: e.target.value as TypographyLayer['textTransform'] })}>
            <option value="none">Aucune</option>
            <option value="uppercase">MAJUSCULES</option>
            <option value="lowercase">minuscules</option>
          </select>
        </InspField>

        <InspField label="Alignement">
          <select className={cn(selectClass, 'w-full')} value={layer.align} disabled={disabled}
            onChange={(e) => onPatch({ align: e.target.value as TypographyLayer['align'] })}>
            <option value="left">Gauche</option>
            <option value="center">Centre</option>
            <option value="right">Droite</option>
          </select>
        </InspField>

        <InspField label="Opacité">
          <InspRange value={layer.opacity} min={0} max={1} step={0.02}
            fmt={(v) => `${Math.round(v * 100)}%`} disabled={disabled}
            onBegin={onBeginContinuous} onLive={(v) => onPatchLive({ opacity: v })} />
        </InspField>

        <InspField label="Profondeur">
          <select className={cn(selectClass, 'w-full')} value={layer.depth} disabled={disabled}
            onChange={(e) => onPatch({ depth: e.target.value as TypographyLayer['depth'] })}>
            <option value="front">Devant la vidéo</option>
            <option value="behind">Derrière le sujet</option>
          </select>
        </InspField>

        <InspField label="Fusion">
          <select className={cn(selectClass, 'w-full')} value={layer.blendMode} disabled={disabled}
            onChange={(e) => onPatch({ blendMode: e.target.value as TypographyLayer['blendMode'] })}>
            {BLEND_MODES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </InspField>

        <InspField label="Rotation">
          <InspRange value={layer.rotation} min={-45} max={45} step={1}
            fmt={(v) => `${Math.round(v)}°`} disabled={disabled}
            onBegin={onBeginContinuous} onLive={(v) => onPatchLive({ rotation: v })} />
        </InspField>

        <InspField label="Position X">
          <InspRange value={layer.x} min={-0.2} max={1.2} step={0.005}
            fmt={(v) => `${Math.round(v * 100)}%`} disabled={disabled}
            onBegin={onBeginContinuous} onLive={(v) => onPatchLive({ x: v })} />
        </InspField>

        <InspField label="Position Y">
          <InspRange value={layer.y} min={-0.2} max={1.2} step={0.005}
            fmt={(v) => `${Math.round(v * 100)}%`} disabled={disabled}
            onBegin={onBeginContinuous} onLive={(v) => onPatchLive({ y: v })} />
        </InspField>

        <InspField label="Largeur max">
          <InspRange value={layer.maxWidth} min={0.3} max={1.4} step={0.01}
            fmt={(v) => `${Math.round(v * 100)}%`} disabled={disabled}
            onBegin={onBeginContinuous} onLive={(v) => onPatchLive({ maxWidth: v })} />
        </InspField>

        <InspField label="Début">
          <InspRange value={layer.startMs} min={0} max={Math.max(1000, totalMs)} step={50}
            fmt={(v) => `${(v / 1000).toFixed(1)}s`} disabled={disabled}
            onBegin={onBeginContinuous} onLive={(v) => onPatchLive({ startMs: v })} />
        </InspField>

        <InspField label="Durée">
          <InspRange value={layer.durationMs} min={300} max={Math.max(2000, totalMs)} step={50}
            fmt={(v) => `${(v / 1000).toFixed(1)}s`} disabled={disabled}
            onBegin={onBeginContinuous} onLive={(v) => onPatchLive({ durationMs: v })} />
        </InspField>

        <InspField label="Animation entrée">
          <select className={cn(selectClass, 'w-full')} value={layer.animIn} disabled={disabled}
            onChange={(e) => onPatch({ animIn: e.target.value as TypographyLayer['animIn'] })}>
            {ANIM_IN.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </InspField>

        <InspField label="Animation sortie">
          <select className={cn(selectClass, 'w-full')} value={layer.animOut} disabled={disabled}
            onChange={(e) => onPatch({ animOut: e.target.value as TypographyLayer['animOut'] })}>
            {ANIM_OUT.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </InspField>

        <InspField label="Durée anim.">
          <InspRange value={layer.animDurationMs} min={0} max={2000} step={50}
            fmt={(v) => `${(v / 1000).toFixed(2)}s`} disabled={disabled}
            onBegin={onBeginContinuous} onLive={(v) => onPatchLive({ animDurationMs: v })} />
        </InspField>
      </div>
    </div>
  );
}

function ExportPanel({
  clipId, canWrite, exports, latestRender,
}: {
  clipId: string;
  canWrite: boolean;
  exports: Export[];
  latestRender: { status: RenderStatus; progress: number } | null;
}) {
  const router = useRouter();
  const [render, setRender] = useState(latestRender);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rendering = render?.status === 'queued' || render?.status === 'rendering';

  useEffect(() => {
    if (rendering || exports.length === 0 || downloadUrl) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/studio/clip/${clipId}/render-status`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { export: { downloadUrl: string | null } | null };
        if (active && data.export?.downloadUrl) setDownloadUrl(data.export.downloadUrl);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [rendering, exports.length, downloadUrl, clipId]);

  useEffect(() => {
    if (!rendering) return;
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/studio/clip/${clipId}/render-status`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: RenderStatus | null;
          progress: number;
          export: { downloadUrl: string | null } | null;
        };
        if (!active) return;
        if (data.status) setRender({ status: data.status, progress: data.progress });
        if (data.export?.downloadUrl) setDownloadUrl(data.export.downloadUrl);
        if (data.status === 'completed' || data.status === 'failed') router.refresh();
      } catch {
        /* keep polling */
      }
    };
    const interval = setInterval(tick, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [rendering, clipId, router]);

  async function startRender() {
    setBusy(true);
    const res = await requestRenderAction(clipId);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success('Rendu lancé.');
    setRender({ status: 'queued', progress: 0 });
  }

  return (
    <Panel title="Export">
      {rendering ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-white/70">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF3D0A]" />
            Rendu en cours… {render?.progress ?? 0}%
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#FF3D0A]" style={{ width: `${render?.progress ?? 0}%` }} />
          </div>
        </div>
      ) : (
        <>
          {canWrite ? (
            <Button size="sm" variant="primary" disabled={busy} onClick={startRender} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
              Lancer le rendu 1080×1920
            </Button>
          ) : null}
          {render?.status === 'failed' ? (
            <p className="mt-2 text-xs text-destructive">Le dernier rendu a échoué. Relancez-le.</p>
          ) : null}
        </>
      )}

      {(downloadUrl || exports.length > 0) && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-white/40">Exports</p>
          {downloadUrl ? (
            <a
              href={downloadUrl}
              className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/15"
            >
              <Download className="h-3.5 w-3.5" /> Télécharger le MP4
            </a>
          ) : exports.length > 0 ? (
            <p className="text-xs text-white/50">
              {exports.length} export{exports.length > 1 ? 's' : ''} disponible — rechargez pour le lien.
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
