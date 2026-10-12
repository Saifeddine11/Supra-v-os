/**
 * SUPRA V3 — Reels Studio domain types.
 * Mirrors supabase/migrations/20261010100000_reels_studio.sql.
 * Hand-maintained (same convention as src/types/database.ts).
 */

export type SourceVideoStatus =
  | 'uploading'
  | 'processing'
  | 'generating_proxy'
  | 'transcribing'
  | 'analyzing'
  | 'ready'
  | 'failed';

export type StudioContentType =
  | 'podcast'
  | 'interview'
  | 'talking_head'
  | 'client_shoot'
  | 'event';

export type StudioWorkflowMode = 'transcript' | 'visual';

export type ClipStatus =
  | 'to_process'
  | 'editing'
  | 'needs_review'
  | 'changes_requested'
  | 'approved'
  | 'exported';

export type ClipOrigin = 'ai' | 'manual' | 'visual';

export type AiSuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'edited';

export type ProcessingJobType =
  | 'ingest'
  | 'proxy'
  | 'thumbnail'
  | 'waveform'
  | 'transcribe'
  | 'analyze';

export type ProcessingJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled';

export type RenderStatus = 'queued' | 'rendering' | 'completed' | 'failed';

export type MediaAssetKind = 'proxy' | 'thumbnail' | 'waveform' | 'poster';

export type SubtitlePreset = 'clean_minimal' | 'bold_social' | 'word_highlight';

export interface CropSettings {
  /** Normalized focal point (0..1). */
  x: number;
  y: number;
  /** >= 1 zoom factor. */
  scale: number;
}

/**
 * Non-cropped 9:16 composition model (blurred background + contained
 * foreground). The authoritative shape lives in `src/remotion/schema.ts`;
 * re-exported here so domain code can reference it without importing Remotion.
 */
export type { ReelCompositionModel } from '@/remotion/schema';

/** Cinematic typography layer shape (authoritative in `src/remotion/typography.ts`). */
export type { TypographyLayer } from '@/remotion/typography';

export interface SubtitleWord {
  text: string;
  start_ms: number;
  end_ms: number;
}

export interface SubtitleStyleConfig {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  highlightColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  backgroundColor?: string | null;
  position?: 'top' | 'center' | 'bottom';
  maxWidthPct?: number;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
  uppercase?: boolean;
  activeWordHighlight?: boolean;
}

export interface BrandKit {
  id: string;
  client_id: string;
  name: string;
  is_default: boolean;
  logo_path: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font_family: string | null;
  subtitle_preset: string;
  subtitle_position: string;
  subtitle_config: SubtitleStyleConfig;
  intro_asset_path: string | null;
  outro_asset_path: string | null;
  safe_zone_top: number;
  safe_zone_bottom: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface SourceVideo {
  id: string;
  client_id: string;
  project_id: string | null;
  title: string;
  content_type: StudioContentType;
  workflow_mode: StudioWorkflowMode;
  status: SourceVideoStatus;
  processing_progress: number;
  error_message: string | null;
  original_storage_path: string | null;
  original_filename: string | null;
  original_size_bytes: number | null;
  mime_type: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  proxy_storage_path: string | null;
  thumbnail_storage_path: string | null;
  waveform_storage_path: string | null;
  language: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface MediaAsset {
  id: string;
  source_video_id: string;
  kind: MediaAssetKind;
  storage_path: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Transcript {
  id: string;
  source_video_id: string;
  language: string;
  engine: string | null;
  model: string | null;
  full_text: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TranscriptSegment {
  id: string;
  transcript_id: string;
  idx: number;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker: string | null;
  created_at: string;
}

export interface TranscriptWord {
  id: string;
  segment_id: string;
  idx: number;
  start_ms: number | null;
  end_ms: number | null;
  text: string;
  confidence: number | null;
}

export interface Clip {
  id: string;
  source_video_id: string;
  client_id: string;
  project_id: string | null;
  brand_kit_id: string | null;
  title: string;
  status: ClipStatus;
  origin: ClipOrigin;
  ai_suggestion_status: AiSuggestionStatus | null;
  aspect_ratio: string;
  /** @deprecated legacy crop model — replaced by `composition`. Kept for back-compat. */
  crop: CropSettings;
  /** Non-cropped 9:16 composition (blurred background + contained foreground). */
  composition: import('@/remotion/schema').ReelCompositionModel;
  /** Ordered cinematic typography layers (draw order = array order). */
  typography: import('@/remotion/typography').TypographyLayer[];
  hook: string | null;
  main_idea: string | null;
  ending: string | null;
  reason: string | null;
  virality_score: number | null;
  confidence_score: number | null;
  subtitle_style: string;
  total_duration_ms: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ClipSegment {
  id: string;
  clip_id: string;
  idx: number;
  source_start_ms: number;
  source_end_ms: number;
  created_at: string;
}

export interface SubtitleTrack {
  id: string;
  clip_id: string;
  name: string;
  language: string;
  style: string;
  style_config: SubtitleStyleConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubtitleCue {
  id: string;
  track_id: string;
  idx: number;
  start_ms: number;
  end_ms: number;
  text: string;
  words: SubtitleWord[];
  created_at: string;
}

export interface ClipSuggestion {
  id: string;
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
  status: AiSuggestionStatus;
  clip_id: string | null;
  created_at: string;
}

export interface ClipComment {
  id: string;
  clip_id: string;
  author_employee_id: string | null;
  timestamp_ms: number | null;
  body: string;
  resolved: boolean;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  job_type: ProcessingJobType;
  status: ProcessingJobStatus;
  source_video_id: string | null;
  payload: Record<string, unknown>;
  progress: number;
  attempts: number;
  max_attempts: number;
  error: string | null;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RenderJob {
  id: string;
  clip_id: string;
  status: RenderStatus;
  progress: number;
  attempts: number;
  max_attempts: number;
  error: string | null;
  requested_by: string | null;
  payload: Record<string, unknown>;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Export {
  id: string;
  clip_id: string;
  render_job_id: string | null;
  storage_path: string;
  format: string;
  codec: string;
  width: number;
  height: number;
  duration_ms: number | null;
  size_bytes: number | null;
  created_at: string;
}

/** AI clip discovery suggestion returned by the analyze worker. */
export interface AiClipSuggestion {
  title: string;
  start_ms: number;
  end_ms: number;
  hook: string;
  main_idea: string;
  ending: string;
  virality_score: number;
  confidence_score: number;
  reason: string;
}
