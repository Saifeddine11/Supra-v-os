-- Date/heure de livraison client (timestamptz). delivery_deadline (date) reste pour compatibilité / index existants.
alter table public.videos
  add column if not exists client_delivery_at timestamptz null;

comment on column public.videos.shooting_date is
  'Date et heure prévues du tournage vidéo (équipe + portail client).';

comment on column public.videos.client_delivery_at is
  'Date et heure prévues de livraison ou envoi au client.';

comment on column public.videos.delivery_deadline is
  'Date de livraison (legacy, jour seul). Synchronisée avec client_delivery_at lors des mises à jour app.';

-- Rétrocompatibilité : remplir client_delivery_at depuis delivery_deadline (minuit UTC) si vide.
update public.videos
set client_delivery_at = delivery_deadline::timestamptz
where client_delivery_at is null
  and delivery_deadline is not null;

create index if not exists idx_videos_client_delivery_at on public.videos (client_delivery_at);
create index if not exists idx_videos_shooting_date on public.videos (shooting_date);
