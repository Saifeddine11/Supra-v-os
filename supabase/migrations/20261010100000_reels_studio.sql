-- ============================================================================
-- SUPRA V3 — Reels Studio
-- Long-form source videos → vertical 9:16 social clips.
--
-- Separate module from the existing editorial `videos` tracker. Models the
-- full pipeline: brand kits, source videos, media assets, structured
-- transcripts, clips (multi-segment), subtitle tracks, timestamped review
-- comments, an async job queue, render jobs and export artifacts.
--
-- RLS stays ON everywhere. Staff visibility via auth_user_role() (employees);
-- client-portal users have no employee row → auth_user_role() is null → denied.
-- Heavy media lives in private Storage buckets, accessed through signed URLs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.source_video_status as enum (
    'uploading', 'processing', 'generating_proxy',
    'transcribing', 'analyzing', 'ready', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.studio_content_type as enum (
    'podcast', 'interview', 'talking_head', 'client_shoot', 'event'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.studio_workflow_mode as enum ('transcript', 'visual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.clip_status as enum (
    'to_process', 'editing', 'needs_review',
    'changes_requested', 'approved', 'exported'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.clip_origin as enum ('ai', 'manual', 'visual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_suggestion_status as enum ('pending', 'accepted', 'rejected', 'edited');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.processing_job_type as enum (
    'ingest', 'proxy', 'thumbnail', 'waveform', 'transcribe', 'analyze'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.processing_job_status as enum (
    'queued', 'running', 'completed', 'failed', 'canceled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.render_status as enum ('queued', 'rendering', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_asset_kind as enum ('proxy', 'thumbnail', 'waveform', 'poster');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Auth helper: who can author/modify studio data (write scope).
-- Read scope = any staff (auth_user_role() is not null).
-- ---------------------------------------------------------------------------
create or replace function public.auth_can_use_studio()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.auth_user_role() in (
    'admin'::public.user_role,
    'project_manager'::public.user_role,
    'department_supervisor'::public.user_role,
    'editor'::public.user_role,
    'cameraman'::public.user_role,
    'community_manager'::public.user_role
  );
$$;

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger (self-contained for this module)
-- ---------------------------------------------------------------------------
create or replace function public.reels_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- BRAND KITS (reusable per client)
-- ============================================================================
create table if not exists public.brand_kits (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  name                text not null default 'Default',
  is_default          boolean not null default false,
  logo_path           text,
  primary_color       text,
  secondary_color     text,
  font_family         text,
  subtitle_preset     text not null default 'clean_minimal',
  subtitle_position   text not null default 'bottom',
  subtitle_config     jsonb not null default '{}'::jsonb,
  intro_asset_path    text,
  outro_asset_path    text,
  safe_zone_top       numeric(4,3) not null default 0.08,
  safe_zone_bottom    numeric(4,3) not null default 0.12,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  constraint brand_kits_primary_color_check
    check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint brand_kits_secondary_color_check
    check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);
create index if not exists idx_brand_kits_client on public.brand_kits(client_id);
create unique index if not exists brand_kits_one_default_per_client
  on public.brand_kits(client_id) where is_default;

-- ============================================================================
-- SOURCE VIDEOS (the untouched long-form master + derived state)
-- ============================================================================
create table if not exists public.source_videos (
  id                    uuid primary key default uuid_generate_v4(),
  client_id             uuid not null references public.clients(id) on delete cascade,
  project_id            uuid references public.projects(id) on delete set null,
  title                 text not null,
  content_type          public.studio_content_type not null default 'podcast',
  workflow_mode         public.studio_workflow_mode not null default 'transcript',
  status                public.source_video_status not null default 'uploading',
  processing_progress   int not null default 0 check (processing_progress between 0 and 100),
  error_message         text,

  -- Original master (never mutated)
  original_storage_path text,
  original_filename     text,
  original_size_bytes   bigint,
  mime_type             text,

  -- Probed metadata
  duration_seconds      numeric(12,3),
  width                 int,
  height                int,
  fps                   numeric(7,3),

  -- Derived editing assets
  proxy_storage_path    text,
  thumbnail_storage_path text,
  waveform_storage_path text,

  language              text not null default 'fr',

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id) on delete set null
);
create index if not exists idx_source_videos_client on public.source_videos(client_id);
create index if not exists idx_source_videos_project on public.source_videos(project_id);
create index if not exists idx_source_videos_status on public.source_videos(status);
create index if not exists idx_source_videos_created on public.source_videos(created_at desc);

-- Extra / future media variants (keeps schema open without reshaping columns)
create table if not exists public.media_assets (
  id                uuid primary key default uuid_generate_v4(),
  source_video_id   uuid not null references public.source_videos(id) on delete cascade,
  kind              public.media_asset_kind not null,
  storage_path      text not null,
  meta              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists idx_media_assets_source on public.media_assets(source_video_id);

-- ============================================================================
-- TRANSCRIPTS (structured, editable — kept separate from clip subtitles)
-- ============================================================================
create table if not exists public.transcripts (
  id                uuid primary key default uuid_generate_v4(),
  source_video_id   uuid not null unique references public.source_videos(id) on delete cascade,
  language          text not null default 'fr',
  engine            text,
  model             text,
  full_text         text,
  status            text not null default 'ready',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.transcript_segments (
  id                uuid primary key default uuid_generate_v4(),
  transcript_id     uuid not null references public.transcripts(id) on delete cascade,
  idx               int not null,
  start_ms          int not null,
  end_ms            int not null,
  text              text not null default '',
  speaker           text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_transcript_segments_transcript
  on public.transcript_segments(transcript_id, start_ms);

create table if not exists public.transcript_words (
  id                uuid primary key default uuid_generate_v4(),
  segment_id        uuid not null references public.transcript_segments(id) on delete cascade,
  idx               int not null,
  start_ms          int,
  end_ms            int,
  text              text not null,
  confidence        numeric(5,4)
);
create index if not exists idx_transcript_words_segment
  on public.transcript_words(segment_id, idx);

-- ============================================================================
-- CLIPS (support MULTIPLE source segments → one reel)
-- ============================================================================
create table if not exists public.clips (
  id                  uuid primary key default uuid_generate_v4(),
  source_video_id     uuid not null references public.source_videos(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,
  project_id          uuid references public.projects(id) on delete set null,
  brand_kit_id        uuid references public.brand_kits(id) on delete set null,
  title               text not null default 'Nouveau clip',
  status              public.clip_status not null default 'to_process',
  origin              public.clip_origin not null default 'manual',
  ai_suggestion_status public.ai_suggestion_status,

  aspect_ratio        text not null default '9:16',
  -- Crop stored as metadata and applied only at render time. {x,y,scale}
  crop                jsonb not null default '{"x":0.5,"y":0.5,"scale":1}'::jsonb,

  -- Editorial signals (AI or manual)
  hook                text,
  main_idea           text,
  ending              text,
  reason              text,
  virality_score      numeric(5,2),
  confidence_score    numeric(5,2),

  subtitle_style      text not null default 'clean_minimal',
  total_duration_ms   int not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null
);
create index if not exists idx_clips_source on public.clips(source_video_id);
create index if not exists idx_clips_client on public.clips(client_id);
create index if not exists idx_clips_status on public.clips(status);
create index if not exists idx_clips_created on public.clips(created_at desc);

create table if not exists public.clip_segments (
  id                uuid primary key default uuid_generate_v4(),
  clip_id           uuid not null references public.clips(id) on delete cascade,
  idx               int not null,
  source_start_ms   int not null,
  source_end_ms     int not null,
  created_at        timestamptz not null default now(),
  constraint clip_segments_range_check check (source_end_ms > source_start_ms)
);
create index if not exists idx_clip_segments_clip on public.clip_segments(clip_id, idx);

-- ============================================================================
-- AI CLIP SUGGESTIONS (editorial recommendations — NOT auto-published clips)
-- Accepting a suggestion creates a real clip (clip_id backref).
-- ============================================================================
create table if not exists public.clip_suggestions (
  id                uuid primary key default uuid_generate_v4(),
  source_video_id   uuid not null references public.source_videos(id) on delete cascade,
  title             text not null default '',
  start_ms          int not null,
  end_ms            int not null,
  hook              text,
  main_idea         text,
  ending            text,
  reason            text,
  virality_score    numeric(5,2),
  confidence_score  numeric(5,2),
  status            public.ai_suggestion_status not null default 'pending',
  clip_id           uuid references public.clips(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_clip_suggestions_source
  on public.clip_suggestions(source_video_id, virality_score desc);

-- ============================================================================
-- SUBTITLE TRACKS + CUES (independent from the source transcript)
-- ============================================================================
create table if not exists public.subtitle_tracks (
  id                uuid primary key default uuid_generate_v4(),
  clip_id           uuid not null references public.clips(id) on delete cascade,
  name              text not null default 'Principal',
  language          text not null default 'fr',
  style             text not null default 'clean_minimal',
  style_config      jsonb not null default '{}'::jsonb,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_subtitle_tracks_clip on public.subtitle_tracks(clip_id);

create table if not exists public.subtitle_cues (
  id                uuid primary key default uuid_generate_v4(),
  track_id          uuid not null references public.subtitle_tracks(id) on delete cascade,
  idx               int not null,
  -- Times are relative to the assembled clip timeline (not the source)
  start_ms          int not null,
  end_ms            int not null,
  text              text not null default '',
  words             jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  constraint subtitle_cues_range_check check (end_ms >= start_ms)
);
create index if not exists idx_subtitle_cues_track on public.subtitle_cues(track_id, start_ms);

-- ============================================================================
-- REVIEW COMMENTS (timestamped)
-- ============================================================================
create table if not exists public.clip_comments (
  id                 uuid primary key default uuid_generate_v4(),
  clip_id            uuid not null references public.clips(id) on delete cascade,
  author_employee_id uuid references public.employees(id) on delete set null,
  timestamp_ms       int,
  body               text not null,
  resolved           boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists idx_clip_comments_clip on public.clip_comments(clip_id, created_at);

-- ============================================================================
-- JOB QUEUE (ingest pipeline) — consumed by the external worker
-- ============================================================================
create table if not exists public.processing_jobs (
  id                uuid primary key default uuid_generate_v4(),
  job_type          public.processing_job_type not null,
  status            public.processing_job_status not null default 'queued',
  source_video_id   uuid references public.source_videos(id) on delete cascade,
  payload           jsonb not null default '{}'::jsonb,
  progress          int not null default 0 check (progress between 0 and 100),
  attempts          int not null default 0,
  max_attempts      int not null default 3,
  error             text,
  locked_at         timestamptz,
  locked_by         text,
  scheduled_at      timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_processing_jobs_poll
  on public.processing_jobs(status, scheduled_at);
create index if not exists idx_processing_jobs_source on public.processing_jobs(source_video_id);

-- ============================================================================
-- RENDER JOBS (final MP4 renders) + EXPORTS (artifacts)
-- ============================================================================
create table if not exists public.render_jobs (
  id                uuid primary key default uuid_generate_v4(),
  clip_id           uuid not null references public.clips(id) on delete cascade,
  status            public.render_status not null default 'queued',
  progress          int not null default 0 check (progress between 0 and 100),
  attempts          int not null default 0,
  max_attempts      int not null default 3,
  error             text,
  requested_by      uuid references public.employees(id) on delete set null,
  payload           jsonb not null default '{}'::jsonb,
  locked_at         timestamptz,
  locked_by         text,
  scheduled_at      timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_render_jobs_poll on public.render_jobs(status, scheduled_at);
create index if not exists idx_render_jobs_clip on public.render_jobs(clip_id);

create table if not exists public.exports (
  id                uuid primary key default uuid_generate_v4(),
  clip_id           uuid not null references public.clips(id) on delete cascade,
  render_job_id     uuid references public.render_jobs(id) on delete set null,
  storage_path      text not null,
  format            text not null default 'mp4',
  codec             text not null default 'h264',
  width             int not null default 1080,
  height            int not null default 1920,
  duration_ms       int,
  size_bytes        bigint,
  created_at        timestamptz not null default now()
);
create index if not exists idx_exports_clip on public.exports(clip_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'brand_kits','source_videos','transcripts','clips',
    'subtitle_tracks','processing_jobs','render_jobs'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I;', t, t);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I
         for each row execute function public.reels_set_updated_at();', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Atomic job-claim RPCs (FOR UPDATE SKIP LOCKED). Worker uses service role.
-- ---------------------------------------------------------------------------
create or replace function public.claim_processing_job(p_worker text)
returns public.processing_jobs
language plpgsql
security definer
set search_path = public
as $$
declare j public.processing_jobs;
begin
  select * into j
  from public.processing_jobs
  where status = 'queued' and scheduled_at <= now()
  order by scheduled_at
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.processing_jobs
  set status = 'running',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = p_worker,
      started_at = coalesce(started_at, now())
  where id = j.id
  returning * into j;

  return j;
end;
$$;

create or replace function public.claim_render_job(p_worker text)
returns public.render_jobs
language plpgsql
security definer
set search_path = public
as $$
declare j public.render_jobs;
begin
  select * into j
  from public.render_jobs
  where status = 'queued' and scheduled_at <= now()
  order by scheduled_at
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.render_jobs
  set status = 'rendering',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = p_worker,
      started_at = coalesce(started_at, now())
  where id = j.id
  returning * into j;

  return j;
end;
$$;

-- ============================================================================
-- STORAGE BUCKETS (private; signed URLs only)
-- reels-source : large masters (resumable TUS uploads, up to ~51 GB)
-- reels-media  : proxies, thumbnails, waveforms, exports, brand assets
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('reels-source', 'reels-source', false, 54760833024),
  ('reels-media',  'reels-media',  false, 2147483648)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- Staff may upload/read/update objects in the reels buckets (authenticated,
-- employee role present). Downloads for private media still go through signed
-- URLs created server-side; these policies enable authenticated resumable
-- uploads from the browser without exposing the service role.
do $$
declare b text;
begin
  foreach b in array array['reels-source','reels-media'] loop
    execute format($f$drop policy if exists "studio_%1$s_insert" on storage.objects;$f$, b);
    execute format($f$drop policy if exists "studio_%1$s_select" on storage.objects;$f$, b);
    execute format($f$drop policy if exists "studio_%1$s_update" on storage.objects;$f$, b);
    execute format($f$drop policy if exists "studio_%1$s_delete" on storage.objects;$f$, b);

    execute format($f$
      create policy "studio_%1$s_insert" on storage.objects
        for insert to authenticated
        with check (bucket_id = %1$L and public.auth_can_use_studio());$f$, b);
    execute format($f$
      create policy "studio_%1$s_select" on storage.objects
        for select to authenticated
        using (bucket_id = %1$L and public.auth_user_role() is not null);$f$, b);
    execute format($f$
      create policy "studio_%1$s_update" on storage.objects
        for update to authenticated
        using (bucket_id = %1$L and public.auth_can_use_studio())
        with check (bucket_id = %1$L and public.auth_can_use_studio());$f$, b);
    execute format($f$
      create policy "studio_%1$s_delete" on storage.objects
        for delete to authenticated
        using (bucket_id = %1$L and public.auth_is_admin_or_pm());$f$, b);
  end loop;
end $$;

-- ============================================================================
-- RLS: enable + policies for all studio tables
-- SELECT  : any staff (auth_user_role() is not null)
-- WRITE   : auth_can_use_studio()
-- DELETE  : auth_is_admin_or_pm()
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'brand_kits','source_videos','media_assets','transcripts',
    'transcript_segments','transcript_words','clips','clip_segments',
    'clip_suggestions','subtitle_tracks','subtitle_cues','clip_comments',
    'processing_jobs','render_jobs','exports'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('revoke all on public.%I from anon;', t);

    execute format('drop policy if exists "%1$s_select_staff" on public.%1$I;', t);
    execute format('drop policy if exists "%1$s_insert_staff" on public.%1$I;', t);
    execute format('drop policy if exists "%1$s_update_staff" on public.%1$I;', t);
    execute format('drop policy if exists "%1$s_delete_staff" on public.%1$I;', t);

    execute format($p$
      create policy "%1$s_select_staff" on public.%1$I
        for select to authenticated
        using (public.auth_user_role() is not null);$p$, t);
    execute format($p$
      create policy "%1$s_insert_staff" on public.%1$I
        for insert to authenticated
        with check (public.auth_can_use_studio());$p$, t);
    execute format($p$
      create policy "%1$s_update_staff" on public.%1$I
        for update to authenticated
        using (public.auth_can_use_studio())
        with check (public.auth_can_use_studio());$p$, t);
    execute format($p$
      create policy "%1$s_delete_staff" on public.%1$I
        for delete to authenticated
        using (public.auth_is_admin_or_pm());$p$, t);
  end loop;
end $$;

-- Reviewers (any staff) may add review comments even if not a studio writer.
drop policy if exists "clip_comments_insert_staff" on public.clip_comments;
create policy "clip_comments_insert_staff" on public.clip_comments
  for insert to authenticated
  with check (public.auth_user_role() is not null);
