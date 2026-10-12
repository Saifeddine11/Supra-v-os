import { createClient } from '@/lib/supabase/server';
import { parseComposition } from '@/remotion/schema';
import { parseTypographyLayers } from '@/remotion/typography';
import type {
  BrandKit,
  Clip,
  ClipComment,
  ClipSegment,
  ClipSuggestion,
  Export,
  ProcessingJob,
  RenderJob,
  SourceVideo,
  SubtitleCue,
  SubtitleTrack,
  Transcript,
  TranscriptSegment,
  TranscriptWord,
} from '@/types/studio';

export interface StudioClientRef {
  id: string;
  name: string;
  color_hex: string | null;
}

export interface StudioProjectRef {
  id: string;
  title: string;
}

export type SourceVideoWithClient = SourceVideo & {
  clients: { name: string; color_hex: string | null } | null;
  clip_count: number;
};

export async function listStudioClients(): Promise<StudioClientRef[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, color_hex')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioClientRef[];
}

export async function listProjectsForClient(clientId: string): Promise<StudioProjectRef[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, title')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioProjectRef[];
}

export async function listSourceVideos(filters?: {
  clientId?: string;
}): Promise<SourceVideoWithClient[]> {
  const supabase = await createClient();
  let query = supabase
    .from('source_videos')
    .select('*, clients(name, color_hex)')
    .order('created_at', { ascending: false });
  if (filters?.clientId) query = query.eq('client_id', filters.clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (SourceVideo & {
    clients: { name: string; color_hex: string | null } | null;
  })[];
  if (rows.length === 0) return [];

  // Clip counts (one grouped query)
  const ids = rows.map((r) => r.id);
  const { data: clipRows } = await supabase
    .from('clips')
    .select('source_video_id')
    .in('source_video_id', ids);
  const counts = new Map<string, number>();
  for (const c of (clipRows ?? []) as { source_video_id: string }[]) {
    counts.set(c.source_video_id, (counts.get(c.source_video_id) ?? 0) + 1);
  }
  return rows.map((r) => ({ ...r, clip_count: counts.get(r.id) ?? 0 }));
}

export async function getSourceVideo(id: string): Promise<SourceVideoWithClient | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('source_videos')
    .select('*, clients(name, color_hex)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { count } = await supabase
    .from('clips')
    .select('id', { count: 'exact', head: true })
    .eq('source_video_id', id);
  return { ...(data as SourceVideoWithClient), clip_count: count ?? 0 };
}

export async function getSourceJobs(sourceVideoId: string): Promise<ProcessingJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('processing_jobs')
    .select('*')
    .eq('source_video_id', sourceVideoId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProcessingJob[];
}

export interface FullTranscript {
  transcript: Transcript;
  segments: (TranscriptSegment & { words: TranscriptWord[] })[];
}

export async function getTranscript(sourceVideoId: string): Promise<FullTranscript | null> {
  const supabase = await createClient();
  const { data: t, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('source_video_id', sourceVideoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) return null;
  const transcript = t as Transcript;

  const { data: segs } = await supabase
    .from('transcript_segments')
    .select('*')
    .eq('transcript_id', transcript.id)
    .order('idx');
  const segments = (segs ?? []) as TranscriptSegment[];

  const segIds = segments.map((s) => s.id);
  const wordMap = new Map<string, TranscriptWord[]>();
  if (segIds.length > 0) {
    const { data: words } = await supabase
      .from('transcript_words')
      .select('*')
      .in('segment_id', segIds)
      .order('idx');
    for (const w of (words ?? []) as TranscriptWord[]) {
      const arr = wordMap.get(w.segment_id) ?? [];
      arr.push(w);
      wordMap.set(w.segment_id, arr);
    }
  }

  return {
    transcript,
    segments: segments.map((s) => ({ ...s, words: wordMap.get(s.id) ?? [] })),
  };
}

export async function listSuggestions(sourceVideoId: string): Promise<ClipSuggestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clip_suggestions')
    .select('*')
    .eq('source_video_id', sourceVideoId)
    .order('virality_score', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClipSuggestion[];
}

export async function listClips(sourceVideoId: string): Promise<Clip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clips')
    .select('*')
    .eq('source_video_id', sourceVideoId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Clip[];
}

export interface FullClip {
  clip: Clip;
  source: SourceVideo;
  segments: ClipSegment[];
  tracks: (SubtitleTrack & { cues: SubtitleCue[] })[];
  comments: ClipComment[];
  brandKit: BrandKit | null;
  exports: Export[];
}

export async function getClip(id: string): Promise<FullClip | null> {
  const supabase = await createClient();
  const { data: c, error } = await supabase.from('clips').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) return null;
  const clip = {
    ...(c as Clip),
    composition: parseComposition((c as { composition?: unknown }).composition),
    typography: parseTypographyLayers((c as { typography?: unknown }).typography),
  } as Clip;

  const [{ data: source }, { data: segs }, { data: tracks }, { data: comments }, { data: exps }] =
    await Promise.all([
      supabase.from('source_videos').select('*').eq('id', clip.source_video_id).maybeSingle(),
      supabase.from('clip_segments').select('*').eq('clip_id', id).order('idx'),
      supabase.from('subtitle_tracks').select('*').eq('clip_id', id).order('created_at'),
      supabase.from('clip_comments').select('*').eq('clip_id', id).order('created_at'),
      supabase.from('exports').select('*').eq('clip_id', id).order('created_at', { ascending: false }),
    ]);

  const trackRows = (tracks ?? []) as SubtitleTrack[];
  const trackIds = trackRows.map((t) => t.id);
  const cueMap = new Map<string, SubtitleCue[]>();
  if (trackIds.length > 0) {
    const { data: cues } = await supabase
      .from('subtitle_cues')
      .select('*')
      .in('track_id', trackIds)
      .order('start_ms');
    for (const cue of (cues ?? []) as SubtitleCue[]) {
      const arr = cueMap.get(cue.track_id) ?? [];
      arr.push(cue);
      cueMap.set(cue.track_id, arr);
    }
  }

  let brandKit: BrandKit | null = null;
  if (clip.brand_kit_id) {
    const { data: bk } = await supabase
      .from('brand_kits')
      .select('*')
      .eq('id', clip.brand_kit_id)
      .maybeSingle();
    brandKit = (bk ?? null) as BrandKit | null;
  }

  return {
    clip,
    source: source as SourceVideo,
    segments: (segs ?? []) as ClipSegment[],
    tracks: trackRows.map((t) => ({ ...t, cues: cueMap.get(t.id) ?? [] })),
    comments: (comments ?? []) as ClipComment[],
    brandKit,
    exports: (exps ?? []) as Export[],
  };
}

export async function listBrandKits(clientId: string): Promise<BrandKit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('client_id', clientId)
    .order('is_default', { ascending: false })
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as BrandKit[];
}

export async function getLatestRenderJob(clipId: string): Promise<RenderJob | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('render_jobs')
    .select('*')
    .eq('clip_id', clipId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as RenderJob | null;
}
