# SUPRA V3 — Reels Studio

Internal workflow to turn long-form videos (podcasts, interviews, talking-head,
client shoots, events) into polished vertical 9:16 social clips. Built as a new,
isolated module inside the existing Agency OS — it does **not** touch the existing
editorial `videos` tracker, auth, middleware, or portal.

---

## 1. Architecture summary

```
Next.js (App Router)                         Postgres (Supabase)
 ├─ /studio               source list         ┌─ brand_kits
 ├─ /studio/source/[id]   pipeline + AI        ├─ source_videos ── media_assets
 ├─ /studio/clip/[id]     9:16 editor          ├─ transcripts ─ segments ─ words
 ├─ server actions  ──────enqueue jobs────────►├─ clip_suggestions
 └─ /api/studio/*         status polling       ├─ clips ─ clip_segments
                                               ├─ subtitle_tracks ─ subtitle_cues
Supabase Storage (private, signed URLs)        ├─ clip_comments
 ├─ reels-source   long-form masters (TUS)     ├─ processing_jobs   (ingest queue)
 └─ reels-media    proxies/thumbs/waveforms/    └─ render_jobs ─ exports
                   exports/brand assets
                                      ▲
Worker (standalone Node + FFmpeg + faster-whisper)
 claim_processing_job / claim_render_job  (FOR UPDATE SKIP LOCKED)
 ingest → proxy → thumbnail → waveform → transcribe → analyze → ready
 render → crop 9:16 + scale 1080×1920 + concat segments + burn subtitles → export
```

Key principles enforced:
- The original master is never modified; only derived assets are written.
- FFmpeg/Whisper never run inside a Next.js request — only in the worker.
- Heavy media never touches DB rows; only storage paths + signed URLs.
- The editor loads the **proxy**, never the 4K master.
- AI suggestions are editorial recommendations (separate table); a human accepts,
  edits or rejects. Nothing is auto-published.
- RLS stays ON. Staff-only (`auth_user_role()` from `employees`); portal clients
  have no employee row → denied.

## 2. Database schema

Migration: `supabase/migrations/20261010100000_reels_studio.sql`.

| Table | Purpose |
|---|---|
| `brand_kits` | Per-client reusable branding (logo, colors, font, subtitle preset/position, intro/outro, safe zones). One default per client. |
| `source_videos` | The long-form master + processing state (`uploading → processing → generating_proxy → transcribing → analyzing → ready / failed`), probed metadata, proxy/thumbnail/waveform paths. |
| `media_assets` | Extra derived assets (open for future variants). |
| `transcripts` / `transcript_segments` / `transcript_words` | Structured, editable FR transcript with word-level timestamps + confidence. |
| `clip_suggestions` | AI editorial recommendations (`pending/accepted/rejected/edited`); accepting creates a clip. |
| `clips` | A reel: status workflow, crop metadata `{x,y,scale}`, hook/idea/ending, scores, subtitle style, brand kit. |
| `clip_segments` | **Multiple** source ranges per clip (event/visual clipping). |
| `subtitle_tracks` / `subtitle_cues` | Clip subtitle track, independent from the source transcript. |
| `clip_comments` | Timestamped review comments. |
| `processing_jobs` | Ingest pipeline queue (progress/attempts/error). |
| `render_jobs` | Final-render queue (`queued/rendering/completed/failed`). |
| `exports` | Rendered MP4 artifacts (path, dimensions, duration, size). |

Enums, triggers (`updated_at`), atomic claim RPCs (`claim_processing_job`,
`claim_render_job`), two private storage buckets and full RLS policies are all in
that migration. Roles: Admin/PM/Dept-supervisor/Editor/Cameraman/Community mgr can
author; Admin/PM can delete; any staff can review/comment (`auth_can_use_studio()`).

## 3. Environment variables

App (`.env.local`) — all already used except nothing new is strictly required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (existing)
- `SUPABASE_SERVICE_ROLE_KEY` (existing — used for signed URLs + source row writes)

Worker (`worker/.env`, see `worker/.env.example`):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `STUDIO_SOURCE_BUCKET=reels-source`, `STUDIO_MEDIA_BUCKET=reels-media`
- `OPENROUTER_API_KEY`, `AI_MODEL` (clip discovery — same provider as the app)
- `WHISPER_MODEL` (`small` default, `large-v3` best FR), `WHISPER_DEVICE`,
  `WHISPER_COMPUTE_TYPE`, `WHISPER_LANGUAGE=fr`, `PYTHON_BIN`
- `FFMPEG_BIN`, `FFPROBE_BIN`, `WORKER_ID`, `POLL_INTERVAL_MS`, `PROXY_HEIGHT`, `WORK_DIR`

## 4. Service / API dependencies

- Supabase (Postgres + Storage + Auth) — existing project.
- FFmpeg + ffprobe (worker host).
- Python 3 + `faster-whisper` (worker host) — French transcription, word timestamps.
- OpenRouter (worker) — transcript → clip suggestions.

## 5. Changed / new files

**New (app)**
- `src/types/studio.ts`
- `src/lib/studio/{constants,time,storage,mutations,upload-client}.ts`
- `src/lib/data/studio.ts`
- `src/app/(app)/studio/**` (pages, actions, upload dialog, status pill, source & clip editors)
- `src/app/api/studio/source/[id]/status/route.ts`
- `src/app/api/studio/clip/[id]/render-status/route.ts`
- `supabase/migrations/20261010100000_reels_studio.sql`

**New (worker)** — `worker/**` (Node service, FFmpeg/Whisper/OpenRouter pipeline, Dockerfile).

**Edited (minimal, additive)**
- `src/config/navigation.ts`, `src/components/app/nav-icons.tsx` (Studio nav entry)
- `src/lib/auth/capabilities.ts`, `src/lib/auth/nav-policy.ts` (Studio RBAC)
- `src/middleware.ts` (JSON 401 for `/api/studio/*`)
- `tsconfig.json` (exclude `worker`), `package.json` (`tus-js-client`)

## 6. Migration instructions

```bash
# From repo root, with Supabase CLI linked (SUPABASE_PROJECT_ID set)
npm run db:push          # applies supabase/migrations/*.sql incl. 20261010100000_reels_studio
# or apply the single file via the Supabase SQL editor / MCP apply_migration
```

The migration seeds the private `reels-source` (≤51 GB) and `reels-media` (≤2 GB)
buckets and all RLS + storage policies.

## 7. Local development

```bash
# App
npm install
npm run dev

# Worker (separate terminal)
cd worker
cp .env.example .env     # fill SUPABASE_*, OPENROUTER_API_KEY
npm install
pip install -r requirements.txt    # faster-whisper
# ensure ffmpeg + ffprobe on PATH
npm run start            # polls queues, processes jobs
```

## 8. Worker instructions / scaling

- Run with Docker: `cd worker && docker build -t supra-reels-worker . && docker run --rm --env-file .env supra-reels-worker`.
- Scale horizontally: run multiple instances with distinct `WORKER_ID`. Job claims
  are atomic (`FOR UPDATE SKIP LOCKED`), so no double-processing.
- First transcription downloads the Whisper model (size per `WHISPER_MODEL`).

## 9. Deployment

- App: deploy on Vercel as usual (no new runtime deps besides `tus-js-client`).
- Worker: deploy the `worker/` Docker image to any long-running host (Railway,
  Render, Fly, a VPS, or a container platform). It needs outbound access to
  Supabase + OpenRouter and enough CPU/RAM for FFmpeg + Whisper. Do **not** run it
  on short-lived serverless functions.

## 10. Build / test results

- `npm run type-check` (app): passes.
- `npm run build` (app): passes — `/studio`, `/studio/source/[id]`,
  `/studio/clip/[id]` and `/api/studio/*` compile; all existing routes unchanged.
- `worker` `npm run type-check`: passes.
- `next lint` is **not configured** in this repo (no eslintrc; it prompts
  interactively) — pre-existing; type-check + build are the gates used here.

## 11. Known limitations / next steps

These are implemented in code but require a live worker + credentials to validate
end-to-end (not exercised in this environment):
- Actual FFmpeg renders and faster-whisper transcription were not run here (no
  worker runtime / Supabase + OpenRouter credentials in the build sandbox). The
  pipeline, SQL, and app build are verified; a full render/transcription pass
  should be smoke-tested on a real worker.
- Browser preview approximates the final crop with CSS `object-position`/`scale`;
  the authoritative crop is computed numerically at render time.
- Subtitle word-level highlight animation is burned via ASS karaoke when word
  timings exist; AI-seeded cues currently carry segment-level timing only.
- Transcript editing UI is read-only (viewer); editing cues happens on the clip
  subtitle track (as designed — source transcript stays separate).
- Storage cleanup on source/clip deletion is DB-cascade only; a storage GC job is
  a recommended follow-up.
- Intro/outro asset burn-in and multi-track subtitles are scaffolded in the schema
  but not yet wired into the render filter graph.
