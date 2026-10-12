import { supabase } from './supabase.js';

export interface SourceRow {
  id: string;
  client_id: string;
  workflow_mode: 'transcript' | 'visual';
  original_storage_path: string | null;
  proxy_storage_path: string | null;
  thumbnail_storage_path: string | null;
  waveform_storage_path: string | null;
}

export async function getSource(id: string): Promise<SourceRow | null> {
  const { data, error } = await supabase
    .from('source_videos')
    .select('id, client_id, workflow_mode, original_storage_path, proxy_storage_path, thumbnail_storage_path, waveform_storage_path')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SourceRow | null) ?? null;
}

export async function updateSource(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('source_videos').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function enqueueJob(jobType: string, sourceVideoId: string): Promise<void> {
  const { error } = await supabase
    .from('processing_jobs')
    .insert({ job_type: jobType, source_video_id: sourceVideoId, status: 'queued' });
  if (error) throw new Error(error.message);
}

export async function setJobProgress(table: string, id: string, progress: number): Promise<void> {
  await supabase.from(table).update({ progress }).eq('id', id);
}

export async function completeJob(table: string, id: string): Promise<void> {
  await supabase
    .from(table)
    .update({ status: 'completed', progress: 100, finished_at: new Date().toISOString() })
    .eq('id', id);
}

export async function failJob(
  table: string,
  id: string,
  attempts: number,
  maxAttempts: number,
  message: string,
): Promise<boolean> {
  const giveUp = attempts >= maxAttempts;
  await supabase
    .from(table)
    .update({
      status: giveUp ? 'failed' : 'queued',
      error: message.slice(0, 2000),
      locked_at: null,
      locked_by: null,
      scheduled_at: giveUp ? undefined : new Date(Date.now() + 5000).toISOString(),
    })
    .eq('id', id);
  return giveUp;
}

// ─── Transcript persistence ────────────────────────────────────────────────
export interface TranscriptSegmentInput {
  start: number;
  end: number;
  text: string;
  words: { start: number; end: number; text: string; confidence: number }[];
}

export async function saveTranscript(
  sourceVideoId: string,
  language: string,
  model: string,
  segments: TranscriptSegmentInput[],
): Promise<void> {
  // Remove any prior transcript (idempotent re-run)
  await supabase.from('transcripts').delete().eq('source_video_id', sourceVideoId);

  const fullText = segments.map((s) => s.text).join(' ').trim();
  const { data: t, error } = await supabase
    .from('transcripts')
    .insert({
      source_video_id: sourceVideoId,
      language,
      engine: 'faster-whisper',
      model,
      full_text: fullText,
      status: 'ready',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const transcriptId = (t as { id: string }).id;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const { data: segRow, error: segErr } = await supabase
      .from('transcript_segments')
      .insert({
        transcript_id: transcriptId,
        idx: i,
        start_ms: Math.round(seg.start * 1000),
        end_ms: Math.round(seg.end * 1000),
        text: seg.text,
      })
      .select('id')
      .single();
    if (segErr) throw new Error(segErr.message);
    const segmentId = (segRow as { id: string }).id;

    if (seg.words.length > 0) {
      const wordRows = seg.words.map((w, wi) => ({
        segment_id: segmentId,
        idx: wi,
        start_ms: Math.round(w.start * 1000),
        end_ms: Math.round(w.end * 1000),
        text: w.text,
        confidence: w.confidence,
      }));
      const { error: wErr } = await supabase.from('transcript_words').insert(wordRows);
      if (wErr) throw new Error(wErr.message);
    }
  }
}

export async function getTranscriptSegments(
  sourceVideoId: string,
): Promise<{ start_ms: number; end_ms: number; text: string }[]> {
  const { data: t } = await supabase
    .from('transcripts')
    .select('id')
    .eq('source_video_id', sourceVideoId)
    .maybeSingle();
  if (!t) return [];
  const { data } = await supabase
    .from('transcript_segments')
    .select('start_ms, end_ms, text')
    .eq('transcript_id', (t as { id: string }).id)
    .order('idx');
  return (data as { start_ms: number; end_ms: number; text: string }[]) ?? [];
}

export async function saveSuggestions(
  sourceVideoId: string,
  suggestions: {
    title: string;
    start_ms: number;
    end_ms: number;
    hook: string;
    main_idea: string;
    ending: string;
    virality_score: number;
    confidence_score: number;
    reason: string;
  }[],
): Promise<void> {
  // Replace prior pending suggestions (idempotent re-run)
  await supabase
    .from('clip_suggestions')
    .delete()
    .eq('source_video_id', sourceVideoId)
    .eq('status', 'pending');
  if (suggestions.length === 0) return;
  const rows = suggestions.map((s) => ({
    source_video_id: sourceVideoId,
    title: s.title,
    start_ms: s.start_ms,
    end_ms: s.end_ms,
    hook: s.hook,
    main_idea: s.main_idea,
    ending: s.ending,
    reason: s.reason,
    virality_score: s.virality_score,
    confidence_score: s.confidence_score,
    status: 'pending',
  }));
  const { error } = await supabase.from('clip_suggestions').insert(rows);
  if (error) throw new Error(error.message);
}

// ─── Render data ──────────────────────────────────────────────────────────
export interface ReelComposition {
  background: { mode?: string; blur: number; dim: number };
  foreground: { fit?: string; offsetY: number; scale: number };
}

export interface RenderData {
  clip: {
    id: string;
    client_id: string;
    source_video_id: string;
    crop: { x: number; y: number; scale: number };
    composition: ReelComposition | null;
    brand_kit_id: string | null;
  };
  source: { original_storage_path: string | null; width: number | null; height: number | null };
  segments: { source_start_ms: number; source_end_ms: number }[];
  cues: { start_ms: number; end_ms: number; text: string; words: unknown[] }[];
  style: Record<string, unknown>;
  logoPath: string | null;
}

export async function getRenderData(clipId: string): Promise<RenderData | null> {
  const { data: clip } = await supabase
    .from('clips')
    .select('id, client_id, source_video_id, crop, composition, brand_kit_id')
    .eq('id', clipId)
    .maybeSingle();
  if (!clip) return null;
  const c = clip as RenderData['clip'];

  const { data: source } = await supabase
    .from('source_videos')
    .select('original_storage_path, width, height')
    .eq('id', c.source_video_id)
    .maybeSingle();

  const { data: segs } = await supabase
    .from('clip_segments')
    .select('source_start_ms, source_end_ms')
    .eq('clip_id', clipId)
    .order('idx');

  const { data: track } = await supabase
    .from('subtitle_tracks')
    .select('id, style_config')
    .eq('clip_id', clipId)
    .eq('is_active', true)
    .maybeSingle();

  let cues: RenderData['cues'] = [];
  let style: Record<string, unknown> = {};
  if (track) {
    const tr = track as { id: string; style_config: Record<string, unknown> };
    style = tr.style_config ?? {};
    const { data: cueRows } = await supabase
      .from('subtitle_cues')
      .select('start_ms, end_ms, text, words')
      .eq('track_id', tr.id)
      .order('start_ms');
    cues = (cueRows as RenderData['cues']) ?? [];
  }

  let logoPath: string | null = null;
  if (c.brand_kit_id) {
    const { data: bk } = await supabase
      .from('brand_kits')
      .select('logo_path')
      .eq('id', c.brand_kit_id)
      .maybeSingle();
    logoPath = (bk as { logo_path: string | null } | null)?.logo_path ?? null;
  }

  return {
    clip: c,
    source: (source as RenderData['source']) ?? { original_storage_path: null, width: null, height: null },
    segments: (segs as RenderData['segments']) ?? [],
    cues,
    style,
    logoPath,
  };
}

export async function insertExport(params: {
  clipId: string;
  renderJobId: string;
  storagePath: string;
  width: number;
  height: number;
  durationMs: number;
  sizeBytes: number;
}): Promise<void> {
  const { error } = await supabase.from('exports').insert({
    clip_id: params.clipId,
    render_job_id: params.renderJobId,
    storage_path: params.storagePath,
    format: 'mp4',
    codec: 'h264',
    width: params.width,
    height: params.height,
    duration_ms: params.durationMs,
    size_bytes: params.sizeBytes,
  });
  if (error) throw new Error(error.message);
  await supabase.from('clips').update({ status: 'exported' }).eq('id', params.clipId);
}
