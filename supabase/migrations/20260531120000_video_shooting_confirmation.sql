-- Confirmation de tournage (PM / admin / cadreur assigné) + historique des reports.

alter table public.videos
  add column if not exists shooting_completed_at timestamptz,
  add column if not exists shooting_postponed_at timestamptz,
  add column if not exists shooting_postponed_reason text,
  add column if not exists shooting_postponed_note text;

comment on column public.videos.shooting_completed_at is 'Horodatage confirmation « tournage fait » (passage montage).';
comment on column public.videos.shooting_postponed_at is 'Dernier report de tournage (métadonnée).';
comment on column public.videos.shooting_postponed_reason is 'Motif du report (libellé ou texte libre).';
comment on column public.videos.shooting_postponed_note is 'Note interne optionnelle sur le report.';

create table if not exists public.video_shooting_events (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  event_type text not null check (event_type in ('confirmed', 'postponed')),
  old_shooting_at timestamptz,
  new_shooting_at timestamptz,
  reason text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_video_shooting_events_video on public.video_shooting_events(video_id);

alter table public.video_shooting_events enable row level security;

drop policy if exists "video_shooting_events_select_scoped" on public.video_shooting_events;
create policy "video_shooting_events_select_scoped"
  on public.video_shooting_events for select
  to authenticated
  using (public.auth_staff_video_visible(video_shooting_events.video_id));

-- Inserts via service role (server actions) ; pas d’INSERT public pour limiter la surface.
