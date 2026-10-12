import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { sourceMasterPath } from '@/lib/studio/storage';
import { STUDIO_SOURCE_BUCKET, subtitlePresetConfig } from '@/lib/studio/constants';
import type {
  AiClipSuggestion,
  ClipStatus,
  CropSettings,
  ProcessingJobType,
  ReelCompositionModel,
  StudioContentType,
  StudioWorkflowMode,
  SubtitleCue,
  SubtitleStyleConfig,
  TypographyLayer,
} from '@/types/studio';

// ─── Source video + upload ───────────────────────────────────────────────────
export interface CreateSourceInput {
  clientId: string;
  projectId: string | null;
  title: string;
  contentType: StudioContentType;
  workflowMode: StudioWorkflowMode;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  createdBy: string | null;
}

export interface CreateSourceResult {
  id: string;
  bucket: string;
  uploadPath: string;
}

export async function createSourceVideo(input: CreateSourceInput): Promise<CreateSourceResult> {
  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const uploadPath = sourceMasterPath(input.clientId, id, input.fileName);

  const { error } = await admin.from('source_videos').insert({
    id,
    client_id: input.clientId,
    project_id: input.projectId,
    title: input.title,
    content_type: input.contentType,
    workflow_mode: input.workflowMode,
    status: 'uploading',
    processing_progress: 0,
    original_storage_path: uploadPath,
    original_filename: input.fileName,
    original_size_bytes: input.sizeBytes,
    mime_type: input.mimeType,
    created_by: input.createdBy,
  });
  if (error) throw new Error(error.message);

  return { id, bucket: STUDIO_SOURCE_BUCKET, uploadPath };
}

export async function enqueueJob(
  jobType: ProcessingJobType,
  sourceVideoId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('processing_jobs').insert({
    job_type: jobType,
    source_video_id: sourceVideoId,
    payload,
    status: 'queued',
  });
  if (error) throw new Error(error.message);
}

/** After the browser finished the resumable upload → start the pipeline. */
export async function markSourceUploaded(sourceVideoId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('source_videos')
    .update({ status: 'processing', processing_progress: 5 })
    .eq('id', sourceVideoId);
  if (error) throw new Error(error.message);
  await enqueueJob('ingest', sourceVideoId);
}

export async function deleteSourceVideo(sourceVideoId: string): Promise<void> {
  const admin = createAdminClient();
  // Storage objects are best-effort cleaned by a maintenance job; DB cascade
  // removes clips/transcripts/jobs.
  const { error } = await admin.from('source_videos').delete().eq('id', sourceVideoId);
  if (error) throw new Error(error.message);
}

// ─── Clips ────────────────────────────────────────────────────────────────────
interface ClipBaseRow {
  source_video_id: string;
  client_id: string;
  project_id: string | null;
  brand_kit_id: string | null;
  created_by: string | null;
}

async function resolveClipBase(sourceVideoId: string, createdBy: string | null): Promise<ClipBaseRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('source_videos')
    .select('id, client_id, project_id')
    .eq('id', sourceVideoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Source introuvable.');
  const row = data as { client_id: string; project_id: string | null };

  const { data: bk } = await admin
    .from('brand_kits')
    .select('id')
    .eq('client_id', row.client_id)
    .eq('is_default', true)
    .maybeSingle();

  return {
    source_video_id: sourceVideoId,
    client_id: row.client_id,
    project_id: row.project_id,
    brand_kit_id: (bk as { id: string } | null)?.id ?? null,
    created_by: createdBy,
  };
}

async function createDefaultSubtitleTrack(clipId: string, style: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('subtitle_tracks').insert({
    clip_id: clipId,
    name: 'Principal',
    language: 'fr',
    style,
    style_config: subtitlePresetConfig(style) as unknown as Record<string, unknown>,
    is_active: true,
  });
  if (error) throw new Error(error.message);
}

export async function createClipFromRanges(params: {
  sourceVideoId: string;
  title: string;
  ranges: { startMs: number; endMs: number }[];
  origin: 'manual' | 'visual';
  createdBy: string | null;
}): Promise<string> {
  const admin = createAdminClient();
  const base = await resolveClipBase(params.sourceVideoId, params.createdBy);
  const total = params.ranges.reduce((acc, r) => acc + Math.max(0, r.endMs - r.startMs), 0);

  const { data, error } = await admin
    .from('clips')
    .insert({
      ...base,
      title: params.title,
      status: 'editing',
      origin: params.origin,
      total_duration_ms: total,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const clipId = (data as { id: string }).id;

  await replaceClipSegments(clipId, params.ranges);
  await createDefaultSubtitleTrack(clipId, 'clean_minimal');
  return clipId;
}

export async function createClipFromSuggestion(params: {
  sourceVideoId: string;
  suggestion: AiClipSuggestion;
  createdBy: string | null;
}): Promise<string> {
  const admin = createAdminClient();
  const base = await resolveClipBase(params.sourceVideoId, params.createdBy);
  const s = params.suggestion;
  const total = Math.max(0, s.end_ms - s.start_ms);

  const { data, error } = await admin
    .from('clips')
    .insert({
      ...base,
      title: s.title,
      status: 'editing',
      origin: 'ai',
      ai_suggestion_status: 'accepted',
      hook: s.hook,
      main_idea: s.main_idea,
      ending: s.ending,
      reason: s.reason,
      virality_score: s.virality_score,
      confidence_score: s.confidence_score,
      total_duration_ms: total,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const clipId = (data as { id: string }).id;

  await replaceClipSegments(clipId, [{ startMs: s.start_ms, endMs: s.end_ms }]);
  await createDefaultSubtitleTrack(clipId, 'clean_minimal');
  await seedSubtitlesFromTranscript(clipId, params.sourceVideoId, s.start_ms, s.end_ms);
  return clipId;
}

export async function acceptSuggestion(params: {
  suggestionId: string;
  startMs?: number;
  endMs?: number;
  title?: string;
  createdBy: string | null;
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('clip_suggestions')
    .select('*')
    .eq('id', params.suggestionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Suggestion introuvable.');
  const s = data as {
    source_video_id: string;
    title: string;
    start_ms: number;
    end_ms: number;
    hook: string | null;
    main_idea: string | null;
    ending: string | null;
    reason: string | null;
    virality_score: number | null;
    confidence_score: number | null;
  };

  const edited = params.startMs !== undefined || params.endMs !== undefined || params.title !== undefined;
  const suggestion: AiClipSuggestion = {
    title: params.title ?? (s.title || 'Clip'),
    start_ms: params.startMs ?? s.start_ms,
    end_ms: params.endMs ?? s.end_ms,
    hook: s.hook ?? '',
    main_idea: s.main_idea ?? '',
    ending: s.ending ?? '',
    reason: s.reason ?? '',
    virality_score: s.virality_score ?? 0,
    confidence_score: s.confidence_score ?? 0,
  };

  const clipId = await createClipFromSuggestion({
    sourceVideoId: s.source_video_id,
    suggestion,
    createdBy: params.createdBy,
  });

  await admin
    .from('clip_suggestions')
    .update({ status: edited ? 'edited' : 'accepted', clip_id: clipId })
    .eq('id', params.suggestionId);

  return clipId;
}

export async function rejectSuggestion(suggestionId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('clip_suggestions')
    .update({ status: 'rejected' })
    .eq('id', suggestionId);
  if (error) throw new Error(error.message);
}

export async function replaceClipSegments(
  clipId: string,
  ranges: { startMs: number; endMs: number }[],
): Promise<void> {
  const admin = createAdminClient();
  await admin.from('clip_segments').delete().eq('clip_id', clipId);
  if (ranges.length > 0) {
    const rows = ranges.map((r, i) => ({
      clip_id: clipId,
      idx: i,
      source_start_ms: Math.round(r.startMs),
      source_end_ms: Math.round(r.endMs),
    }));
    const { error } = await admin.from('clip_segments').insert(rows);
    if (error) throw new Error(error.message);
  }
  const total = ranges.reduce((acc, r) => acc + Math.max(0, r.endMs - r.startMs), 0);
  await admin.from('clips').update({ total_duration_ms: Math.round(total) }).eq('id', clipId);
}

export async function updateClip(
  clipId: string,
  patch: {
    title?: string;
    crop?: CropSettings;
    composition?: ReelCompositionModel;
    typography?: TypographyLayer[];
    subtitleStyle?: string;
    brandKitId?: string | null;
    status?: ClipStatus;
  },
): Promise<void> {
  const admin = createAdminClient();
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.crop !== undefined) update.crop = patch.crop;
  if (patch.composition !== undefined) update.composition = patch.composition;
  if (patch.typography !== undefined) update.typography = patch.typography;
  if (patch.subtitleStyle !== undefined) update.subtitle_style = patch.subtitleStyle;
  if (patch.brandKitId !== undefined) update.brand_kit_id = patch.brandKitId;
  if (patch.status !== undefined) update.status = patch.status;
  if (Object.keys(update).length === 0) return;
  const { error } = await admin.from('clips').update(update).eq('id', clipId);
  if (error) throw new Error(error.message);
}

export async function setClipStatus(clipId: string, status: ClipStatus): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('clips').update({ status }).eq('id', clipId);
  if (error) throw new Error(error.message);
}

// ─── Subtitles ─────────────────────────────────────────────────────────────────
export async function saveSubtitleCues(
  trackId: string,
  cues: Pick<SubtitleCue, 'start_ms' | 'end_ms' | 'text' | 'words'>[],
): Promise<void> {
  const admin = createAdminClient();
  await admin.from('subtitle_cues').delete().eq('track_id', trackId);
  if (cues.length > 0) {
    const rows = cues.map((c, i) => ({
      track_id: trackId,
      idx: i,
      start_ms: Math.round(c.start_ms),
      end_ms: Math.round(c.end_ms),
      text: c.text,
      words: c.words ?? [],
    }));
    const { error } = await admin.from('subtitle_cues').insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function updateSubtitleTrackStyle(
  trackId: string,
  style: string,
  styleConfig: SubtitleStyleConfig,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('subtitle_tracks')
    .update({ style, style_config: styleConfig as unknown as Record<string, unknown> })
    .eq('id', trackId);
  if (error) throw new Error(error.message);
}

/**
 * Pre-fill the clip's subtitle track from the source transcript window.
 * Times are rebased to the clip timeline (segment starts at 0).
 */
async function seedSubtitlesFromTranscript(
  clipId: string,
  sourceVideoId: string,
  startMs: number,
  endMs: number,
): Promise<void> {
  const admin = createAdminClient();
  const { data: t } = await admin
    .from('transcripts')
    .select('id')
    .eq('source_video_id', sourceVideoId)
    .maybeSingle();
  if (!t) return;
  const transcriptId = (t as { id: string }).id;

  const { data: segs } = await admin
    .from('transcript_segments')
    .select('start_ms, end_ms, text')
    .eq('transcript_id', transcriptId)
    .gte('end_ms', startMs)
    .lte('start_ms', endMs)
    .order('idx');

  const { data: track } = await admin
    .from('subtitle_tracks')
    .select('id')
    .eq('clip_id', clipId)
    .eq('is_active', true)
    .maybeSingle();
  if (!track) return;
  const trackId = (track as { id: string }).id;

  const cues = ((segs ?? []) as { start_ms: number; end_ms: number; text: string }[]).map((s) => ({
    start_ms: Math.max(0, s.start_ms - startMs),
    end_ms: Math.max(0, Math.min(endMs, s.end_ms) - startMs),
    text: s.text,
    words: [] as SubtitleCue['words'],
  }));
  await saveSubtitleCues(trackId, cues);
}

// ─── Comments ──────────────────────────────────────────────────────────────────
export async function addComment(params: {
  clipId: string;
  authorEmployeeId: string | null;
  timestampMs: number | null;
  body: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('clip_comments').insert({
    clip_id: params.clipId,
    author_employee_id: params.authorEmployeeId,
    timestamp_ms: params.timestampMs,
    body: params.body,
  });
  if (error) throw new Error(error.message);
}

export async function resolveComment(commentId: string, resolved: boolean): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('clip_comments').update({ resolved }).eq('id', commentId);
  if (error) throw new Error(error.message);
}

// ─── Render ─────────────────────────────────────────────────────────────────────
export async function requestRender(clipId: string, requestedBy: string | null): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('render_jobs')
    .insert({ clip_id: clipId, status: 'queued', requested_by: requestedBy })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await admin.from('clips').update({ status: 'approved' }).eq('id', clipId);
  return (data as { id: string }).id;
}
