-- SUPRA V3 — Reels Studio: non-cropped 9:16 composition model.
--
-- Phase 2 of the cinematic editor upgrade. Adds a `composition` JSON column to
-- `clips` describing the blurred background + contained (non-cropped) foreground.
-- The legacy `crop` column is retained for back-compat but is no longer used by
-- the new composition-based preview/render.

alter table public.clips
  add column if not exists composition jsonb not null
    default '{"background":{"mode":"blur_self","blur":60,"dim":0.28},"foreground":{"fit":"contain","offsetY":0,"scale":1}}'::jsonb;

comment on column public.clips.composition is
  'Non-cropped 9:16 composition: blurred background + contained foreground. Shape mirrors src/remotion/schema.ts (reelCompositionSchema).';
