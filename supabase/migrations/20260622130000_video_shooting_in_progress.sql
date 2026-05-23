-- Tournage multi-jours : statut shooting_in_progress + dates de suivi.

ALTER TYPE public.video_status ADD VALUE IF NOT EXISTS 'shooting_in_progress';

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS shooting_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS shooting_expected_end_at timestamptz;

COMMENT ON COLUMN public.videos.shooting_started_at IS 'Début effectif du tournage (marquage « en cours »).';
COMMENT ON COLUMN public.videos.shooting_expected_end_at IS 'Fin prévue du tournage (optionnel, rappels).';

ALTER TABLE public.video_shooting_events
  ADD COLUMN IF NOT EXISTS expected_end_at timestamptz;

ALTER TABLE public.video_shooting_events
  DROP CONSTRAINT IF EXISTS video_shooting_events_event_type_check;

ALTER TABLE public.video_shooting_events
  ADD CONSTRAINT video_shooting_events_event_type_check
  CHECK (event_type IN ('confirmed', 'postponed', 'in_progress'));
