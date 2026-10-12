import { spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { ensureDir } from './storage.js';

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
}

function run(
  bin: string,
  args: string[],
  onStderr?: (chunk: string) => void,
  cwd?: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, cwd ? { cwd } : undefined);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      onStderr?.(s);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

let subtitlesFilterSupported: boolean | null = null;

/**
 * Detect whether the installed ffmpeg exposes the `subtitles` (libass) filter.
 * Cached after the first probe. Some minimal ffmpeg builds (e.g. certain
 * Homebrew bottles) ship without libass; the Docker image used in production
 * includes it. When unavailable we render without burned-in subtitles rather
 * than failing the whole export.
 */
export async function hasSubtitlesFilter(): Promise<boolean> {
  if (subtitlesFilterSupported !== null) return subtitlesFilterSupported;
  try {
    const { stdout } = await run(config.ffmpegBin, ['-hide_banner', '-filters']);
    subtitlesFilterSupported = /\bsubtitles\b/.test(stdout);
  } catch {
    subtitlesFilterSupported = false;
  }
  return subtitlesFilterSupported;
}

export async function probe(input: string): Promise<ProbeResult> {
  const { stdout } = await run(config.ffprobeBin, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate:format=duration',
    '-of', 'json',
    input,
  ]);
  const json = JSON.parse(stdout) as {
    streams?: { width?: number; height?: number; r_frame_rate?: string }[];
    format?: { duration?: string };
  };
  const stream = json.streams?.[0] ?? {};
  const [num, den] = (stream.r_frame_rate ?? '25/1').split('/').map(Number);
  const fps = den ? num / den : 25;
  return {
    durationSec: Number(json.format?.duration ?? 0),
    width: stream.width ?? 0,
    height: stream.height ?? 0,
    fps: Math.round(fps * 1000) / 1000,
  };
}

export async function generateProxy(input: string, output: string, height: number): Promise<void> {
  await ensureDir(path.dirname(output));
  await run(config.ffmpegBin, [
    '-y', '-i', input,
    // Scale to target height, keep even width, H.264 + AAC, fast start
    '-vf', `scale=-2:${height}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    output,
  ]);
}

export async function extractThumbnail(input: string, output: string, atSec: number): Promise<void> {
  await ensureDir(path.dirname(output));
  await run(config.ffmpegBin, [
    '-y', '-ss', String(Math.max(0, atSec)), '-i', input,
    '-frames:v', '1', '-q:v', '3',
    output,
  ]);
}

/** Produce a downsampled peak array (0..1) for the whole audio track. */
export async function generateWaveform(input: string, buckets = 1200): Promise<number[]> {
  const raw = path.join(config.workDir, `wf_${Date.now()}.pcm`);
  await ensureDir(path.dirname(raw));
  // mono, 8kHz, signed 16-bit little-endian
  await run(config.ffmpegBin, [
    '-y', '-i', input,
    '-ac', '1', '-ar', '8000', '-f', 's16le', raw,
  ]);
  const buf = await readFile(raw);
  await rm(raw, { force: true });
  const samples = buf.length / 2;
  const per = Math.max(1, Math.floor(samples / buckets));
  const peaks: number[] = [];
  for (let i = 0; i < samples; i += per) {
    let max = 0;
    for (let j = i; j < Math.min(i + per, samples); j++) {
      const v = Math.abs(buf.readInt16LE(j * 2)) / 32768;
      if (v > max) max = v;
    }
    peaks.push(Math.round(max * 1000) / 1000);
  }
  return peaks;
}

export interface RenderSegment {
  startSec: number;
  endSec: number;
}

export interface ReelCompositionRender {
  background: { blur: number; dim: number };
  foreground: { offsetY: number; scale: number };
}

export interface RenderOptions {
  input: string;
  output: string;
  segments: RenderSegment[];
  sourceWidth: number;
  sourceHeight: number;
  composition: ReelCompositionRender;
  subtitlePath?: string | null;
  logoPath?: string | null;
  onProgress?: (pct: number) => void;
}

export interface RenderResult {
  /** false when subtitles were requested but ffmpeg lacks the libass filter. */
  subtitlesBurned: boolean;
}

/**
 * Build the vertical 1080x1920 render — NON-CROPPED composition:
 *  - trim + concat multiple source segments
 *  - Layer A: blurred, dimmed, full-canvas background (cover) of the source
 *  - Layer B: the complete, untouched source video (contain) centred + offset
 *  - burn subtitles (ASS, when libass is available)
 *  - optional logo overlay
 *
 * Mirrors src/remotion/ReelComposition.tsx so the FFmpeg export matches the
 * in-editor Remotion preview.
 */
export async function renderVertical(opts: RenderOptions): Promise<RenderResult> {
  await ensureDir(path.dirname(opts.output));
  const { exportWidth: OW, exportHeight: OH } = config;
  const { composition } = opts;

  const blurSigma = Math.max(0, Math.round(composition.background.blur));
  const dim = Math.min(0.8, Math.max(0, composition.background.dim));
  const fgScale = Math.min(1, Math.max(0.5, composition.foreground.scale));
  // Foreground bounding box (content contained within), even dims for H.264.
  let fgW = Math.round(OW * fgScale);
  let fgH = Math.round(OH * fgScale);
  fgW -= fgW % 2;
  fgH -= fgH % 2;
  const offsetYpx = Math.round(composition.foreground.offsetY * OH);

  const bgChain = [
    `scale=${OW}:${OH}:force_original_aspect_ratio=increase`,
    `crop=${OW}:${OH}`,
    ...(blurSigma > 0 ? [`gblur=sigma=${blurSigma}`] : []),
    ...(dim > 0 ? [`drawbox=x=0:y=0:w=iw:h=ih:color=black@${dim}:t=fill`] : []),
    'setsar=1',
  ].join(',');

  const fgChain = `scale=${fgW}:${fgH}:force_original_aspect_ratio=decrease,setsar=1`;

  const filters: string[] = [];
  const concatInputs: string[] = [];
  opts.segments.forEach((seg, i) => {
    // Split each trimmed segment into a background + foreground copy.
    filters.push(
      `[0:v]trim=start=${seg.startSec}:end=${seg.endSec},setpts=PTS-STARTPTS,split=2[s${i}a][s${i}b]`,
    );
    filters.push(`[s${i}a]${bgChain}[bg${i}]`);
    filters.push(`[s${i}b]${fgChain}[fg${i}]`);
    filters.push(`[bg${i}][fg${i}]overlay=x=(W-w)/2:y=(H-h)/2+${offsetYpx}[v${i}]`);
    filters.push(
      `[0:a]atrim=start=${seg.startSec}:end=${seg.endSec},asetpts=PTS-STARTPTS[a${i}]`,
    );
    concatInputs.push(`[v${i}][a${i}]`);
  });

  const n = opts.segments.length;
  filters.push(`${concatInputs.join('')}concat=n=${n}:v=1:a=1[vc][ac]`);

  let lastV = '[vc]';
  // When burning subtitles we run ffmpeg with cwd = the subtitle's directory and
  // reference it by basename. This sidesteps the notoriously fragile filtergraph
  // path escaping (drive colons, quotes, separators) across ffmpeg versions.
  let renderCwd: string | undefined;
  let subtitlesBurned = false;
  if (opts.subtitlePath) {
    if (await hasSubtitlesFilter()) {
      renderCwd = path.dirname(opts.subtitlePath);
      const subsName = path.basename(opts.subtitlePath);
      filters.push(`${lastV}subtitles=${subsName}[vs]`);
      lastV = '[vs]';
      subtitlesBurned = true;
    } else {
      console.warn(
        '[render] ffmpeg has no "subtitles" filter (libass missing) — exporting without burned-in subtitles.',
      );
    }
  }

  const args: string[] = ['-y', '-i', opts.input];
  let logoLabel = '';
  if (opts.logoPath) {
    args.push('-i', opts.logoPath);
    // overlay logo top-center within safe zone
    filters.push(`[1:v]scale=${Math.round(OW * 0.22)}:-1[logo]`);
    filters.push(`${lastV}[logo]overlay=(W-w)/2:${Math.round(OH * 0.04)}[vo]`);
    lastV = '[vo]';
    logoLabel = lastV;
  }

  const totalDuration = opts.segments.reduce((acc, s2) => acc + (s2.endSec - s2.startSec), 0);

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', lastV,
    '-map', '[ac]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    '-progress', 'pipe:2',
    opts.output,
  );
  void logoLabel;

  await run(
    config.ffmpegBin,
    args,
    (chunk) => {
      const m = /out_time_ms=(\d+)/.exec(chunk);
      if (m && totalDuration > 0 && opts.onProgress) {
        const outMs = Number(m[1]) / 1000;
        const pct = Math.min(99, Math.round((outMs / (totalDuration * 1000)) * 100));
        opts.onProgress(pct);
      }
    },
    renderCwd,
  );

  return { subtitlesBurned };
}

export async function writeTextFile(p: string, content: string): Promise<void> {
  await ensureDir(path.dirname(p));
  await writeFile(p, content, 'utf8');
}
