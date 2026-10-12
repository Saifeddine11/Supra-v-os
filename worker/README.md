# SUPRA V3 — Reels Studio Worker

Standalone media-processing service for the Reels Studio. It is **not** part of the
Next.js app and never runs inside a serverless request. It polls two Postgres job
queues (`processing_jobs`, `render_jobs`) and performs heavy work with FFmpeg and
faster-whisper.

## Pipeline

```
ingest → probe (ffprobe) → generate proxy (720p H.264) → thumbnail → waveform
      → [transcript mode] transcribe (faster-whisper, FR, word timestamps)
      → analyze (OpenRouter → clip_suggestions)
      → source status = ready
render → download master → ASS subtitles → crop 9:16 + scale 1080×1920
      → concat multi-segments → burn subtitles → logo overlay → export MP4
      → upload to reels-media → exports row → clip status = exported
```

The master source file is never modified. Only derived assets are written.

## Requirements

- Node.js ≥ 20
- FFmpeg + ffprobe on PATH (`ffmpeg -version`)
- Python 3 with `faster-whisper` (`pip install -r requirements.txt`)

## Run locally (without Docker)

```bash
cd worker
cp .env.example .env         # fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY
npm install
pip install -r requirements.txt
npm run start                # or: npm run dev  (watch mode)
```

## Run with Docker

```bash
cd worker
docker build -t supra-reels-worker .
docker run --rm --env-file .env supra-reels-worker
```

The first transcription downloads the Whisper model (set `WHISPER_MODEL`, e.g.
`small` for a good FR speed/quality balance, `large-v3` for best accuracy).

## Environment

See `.env.example`. The service role key is **server-side only** and must never be
exposed to the browser.

## Scaling

Run multiple instances with distinct `WORKER_ID`. Job claiming is atomic
(`claim_processing_job` / `claim_render_job` use `FOR UPDATE SKIP LOCKED`), so
instances never pick the same job.
