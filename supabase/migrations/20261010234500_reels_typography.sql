-- SUPRA V3 — Phase 3: cinematic typography layers.
-- Stores the ordered array of editable typography layers for each clip.
-- Array order = draw/z-order. Validity is enforced in app code (zod) so legacy
-- clips default to an empty array and always render.

alter table public.clips
  add column if not exists typography jsonb not null default '[]'::jsonb;

comment on column public.clips.typography is
  'SUPRA V3 cinematic typography layers (ordered array). See src/remotion/typography.ts for the schema.';
