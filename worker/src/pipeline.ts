import { existsSync } from 'node:fs';
import { stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { BUCKETS, downloadToFile, uploadFile, uploadBuffer } from './storage.js';
import {
  enqueueJob,
  getRenderData,
  getSource,
  getTranscriptSegments,
  insertExport,
  saveSuggestions,
  saveTranscript,
  updateSource,
  type SourceRow,
} from './db.js';
import {
  extractThumbnail,
  generateProxy,
  generateWaveform,
  probe,
  renderVertical,
  writeTextFile,
} from './ffmpeg.js';
import { transcribe } from './transcribe.js';
import { analyzeTranscript } from './analyze.js';
import { buildAss, type Cue } from './subtitles.js';

// ─── Path helpers (match the app's storage layout) ───────────────────────────
const proxyStoragePath = (clientId: string, id: string) => `${clientId}/${id}/proxy.mp4`;
const thumbStoragePath = (clientId: string, id: string) => `${clientId}/${id}/thumb.jpg`;
const waveformStoragePath = (clientId: string, id: string) => `${clientId}/${id}/waveform.json`;
const exportStoragePath = (clientId: string, clipId: string) =>
  `${clientId}/clips/${clipId}/export_${Date.now()}.mp4`;

const localProxy = (id: string) => path.join(config.workDir, id, 'proxy.mp4');

async function ensureProxyLocal(source: SourceRow): Promise<string> {
  const local = localProxy(source.id);
  if (existsSync(local)) return local;
  if (!source.proxy_storage_path) throw new Error('Proxy manquant.');
  await downloadToFile(BUCKETS.media, source.proxy_storage_path, local);
  return local;
}

// ─── Processing job handlers ──────────────────────────────────────────────────
export interface JobLike {
  id: string;
  job_type: string;
  source_video_id: string | null;
}

export async function handleProcessingJob(job: JobLike): Promise<void> {
  if (!job.source_video_id) throw new Error('source_video_id manquant.');
  const source = await getSource(job.source_video_id);
  if (!source) throw new Error('Source introuvable.');

  switch (job.job_type) {
    case 'ingest':
      return ingest(source);
    case 'proxy':
      return proxy(source);
    case 'thumbnail':
      return thumbnail(source);
    case 'waveform':
      return waveform(source);
    case 'transcribe':
      return transcribeSource(source);
    case 'analyze':
      return analyze(source);
    default:
      throw new Error(`Type de job inconnu: ${job.job_type}`);
  }
}

async function ingest(source: SourceRow): Promise<void> {
  await updateSource(source.id, { status: 'processing', processing_progress: 10 });
  if (!source.original_storage_path) throw new Error('Master manquant.');

  const ext = path.extname(source.original_storage_path) || '.mp4';
  const master = path.join(config.workDir, source.id, `master${ext}`);
  await downloadToFile(BUCKETS.source, source.original_storage_path, master);

  const meta = await probe(master);
  await updateSource(source.id, {
    width: meta.width,
    height: meta.height,
    duration_seconds: meta.durationSec,
    fps: meta.fps,
    status: 'generating_proxy',
    processing_progress: 20,
  });

  // Keep master around for proxy step, reuse immediately:
  const outProxy = localProxy(source.id);
  await generateProxy(master, outProxy, config.proxyHeight);
  const storagePath = proxyStoragePath(source.client_id, source.id);
  await uploadFile(BUCKETS.media, storagePath, outProxy, 'video/mp4');
  await updateSource(source.id, { proxy_storage_path: storagePath, processing_progress: 35 });

  await rm(master, { force: true });
  await enqueueJob('thumbnail', source.id);
}

// `proxy` kept as a standalone retry path if ever enqueued separately.
async function proxy(source: SourceRow): Promise<void> {
  const local = await ensureProxyLocal(source);
  const storagePath = proxyStoragePath(source.client_id, source.id);
  await uploadFile(BUCKETS.media, storagePath, local, 'video/mp4');
  await updateSource(source.id, { proxy_storage_path: storagePath, processing_progress: 35 });
  await enqueueJob('thumbnail', source.id);
}

async function thumbnail(source: SourceRow): Promise<void> {
  const local = await ensureProxyLocal(source);
  const out = path.join(config.workDir, source.id, 'thumb.jpg');
  await extractThumbnail(local, out, 1);
  const storagePath = thumbStoragePath(source.client_id, source.id);
  await uploadFile(BUCKETS.media, storagePath, out, 'image/jpeg');
  await updateSource(source.id, { thumbnail_storage_path: storagePath, processing_progress: 45 });
  await enqueueJob('waveform', source.id);
}

async function waveform(source: SourceRow): Promise<void> {
  const local = await ensureProxyLocal(source);
  const peaks = await generateWaveform(local);
  const storagePath = waveformStoragePath(source.client_id, source.id);
  await uploadBuffer(
    BUCKETS.media,
    storagePath,
    Buffer.from(JSON.stringify({ peaks })),
    'application/json',
  );
  await updateSource(source.id, { waveform_storage_path: storagePath, processing_progress: 55 });

  if (source.workflow_mode === 'transcript') {
    await updateSource(source.id, { status: 'transcribing', processing_progress: 60 });
    await enqueueJob('transcribe', source.id);
  } else {
    // Visual mode: no dialogue analysis — ready for manual clipping.
    await updateSource(source.id, { status: 'ready', processing_progress: 100 });
  }
}

async function transcribeSource(source: SourceRow): Promise<void> {
  await updateSource(source.id, { status: 'transcribing', processing_progress: 65 });
  const local = await ensureProxyLocal(source);
  const result = await transcribe(local);
  await saveTranscript(
    source.id,
    result.language || config.whisperLanguage,
    config.whisperModel,
    result.segments.map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
      words: s.words.map((w) => ({ start: w.start, end: w.end, text: w.text, confidence: w.confidence })),
    })),
  );
  await updateSource(source.id, { status: 'analyzing', processing_progress: 85 });
  await enqueueJob('analyze', source.id);
}

async function analyze(source: SourceRow): Promise<void> {
  await updateSource(source.id, { status: 'analyzing', processing_progress: 90 });
  const segments = await getTranscriptSegments(source.id);
  try {
    const suggestions = await analyzeTranscript(segments);
    await saveSuggestions(source.id, suggestions);
  } catch (e) {
    // Analysis is non-fatal: the source is still usable for manual clipping.
    console.error(`[analyze] ${source.id} failed: ${(e as Error).message}`);
  }
  await updateSource(source.id, { status: 'ready', processing_progress: 100 });
}

// ─── Render job handler ────────────────────────────────────────────────────────
export interface RenderJobLike {
  id: string;
  clip_id: string;
}

export async function handleRenderJob(
  job: RenderJobLike,
  onProgress: (pct: number) => Promise<void>,
): Promise<void> {
  const data = await getRenderData(job.clip_id);
  if (!data) throw new Error('Clip introuvable.');
  if (data.segments.length === 0) throw new Error('Aucun segment à rendre.');
  if (!data.source.original_storage_path) throw new Error('Master source manquant.');
  if (!data.source.width || !data.source.height) throw new Error('Dimensions source inconnues.');

  const workClip = path.join(config.workDir, 'render', job.clip_id);
  const ext = path.extname(data.source.original_storage_path) || '.mp4';
  const master = path.join(workClip, `master${ext}`);
  await downloadToFile(BUCKETS.source, data.source.original_storage_path, master);
  await onProgress(15);

  // Build subtitle file (times already relative to clip timeline)
  let subtitlePath: string | null = null;
  if (data.cues.length > 0) {
    const cues: Cue[] = data.cues.map((c) => ({
      start_ms: c.start_ms,
      end_ms: c.end_ms,
      text: c.text,
      words: Array.isArray(c.words) ? (c.words as Cue['words']) : [],
    }));
    subtitlePath = path.join(workClip, 'subs.ass');
    await writeTextFile(subtitlePath, buildAss(cues, data.style));
  }

  let logoLocal: string | null = null;
  if (data.logoPath) {
    try {
      logoLocal = path.join(workClip, 'logo.png');
      await downloadToFile(BUCKETS.media, data.logoPath, logoLocal);
    } catch {
      logoLocal = null;
    }
  }

  const output = path.join(workClip, 'export.mp4');
  const segments = data.segments.map((s) => ({
    startSec: s.source_start_ms / 1000,
    endSec: s.source_end_ms / 1000,
  }));
  const totalMs = data.segments.reduce((a, s) => a + (s.source_end_ms - s.source_start_ms), 0);

  const composition = {
    background: {
      blur: data.clip.composition?.background?.blur ?? 60,
      dim: data.clip.composition?.background?.dim ?? 0.28,
    },
    foreground: {
      offsetY: data.clip.composition?.foreground?.offsetY ?? 0,
      scale: data.clip.composition?.foreground?.scale ?? 1,
    },
  };

  const renderResult = await renderVertical({
    input: master,
    output,
    segments,
    sourceWidth: data.source.width,
    sourceHeight: data.source.height,
    composition,
    subtitlePath,
    logoPath: logoLocal,
    onProgress: (pct) => {
      void onProgress(Math.max(15, Math.min(95, pct)));
    },
  });
  if (subtitlePath && !renderResult.subtitlesBurned) {
    console.warn(
      `[render] ${job.clip_id}: exported without burned-in subtitles (ffmpeg libass unavailable).`,
    );
  }

  const storagePath = exportStoragePath(data.clip.client_id, job.clip_id);
  await uploadFile(BUCKETS.media, storagePath, output, 'video/mp4');
  const size = (await stat(output)).size;

  await insertExport({
    clipId: job.clip_id,
    renderJobId: job.id,
    storagePath,
    width: config.exportWidth,
    height: config.exportHeight,
    durationMs: totalMs,
    sizeBytes: size,
  });

  await rm(workClip, { recursive: true, force: true });
  await onProgress(100);
}
