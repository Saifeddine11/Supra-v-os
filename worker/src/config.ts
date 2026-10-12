import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`[config] Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  sourceBucket: process.env.STUDIO_SOURCE_BUCKET?.trim() || 'reels-source',
  mediaBucket: process.env.STUDIO_MEDIA_BUCKET?.trim() || 'reels-media',

  openRouterApiKey: process.env.OPENROUTER_API_KEY?.trim() || '',
  aiModel: process.env.AI_MODEL?.trim() || 'openrouter/auto',

  whisperModel: process.env.WHISPER_MODEL?.trim() || 'small',
  whisperDevice: process.env.WHISPER_DEVICE?.trim() || 'cpu',
  whisperComputeType: process.env.WHISPER_COMPUTE_TYPE?.trim() || 'int8',
  whisperLanguage: process.env.WHISPER_LANGUAGE?.trim() || 'fr',
  pythonBin: process.env.PYTHON_BIN?.trim() || 'python3',

  ffmpegBin: process.env.FFMPEG_BIN?.trim() || 'ffmpeg',
  ffprobeBin: process.env.FFPROBE_BIN?.trim() || 'ffprobe',

  workerId: process.env.WORKER_ID?.trim() || `worker-${process.pid}`,
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 3000),
  proxyHeight: Number(process.env.PROXY_HEIGHT ?? 720),
  workDir: process.env.WORK_DIR?.trim() || '/tmp/supra-reels',

  exportWidth: 1080,
  exportHeight: 1920,
};

export type Config = typeof config;
