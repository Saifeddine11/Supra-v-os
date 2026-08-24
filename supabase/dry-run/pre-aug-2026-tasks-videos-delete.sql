-- ============================================================================
-- READ-ONLY verification. The delete already ran on production 2026-08-20.
-- Do not DELETE from this file. Safe to Run in the SQL Editor.
-- Cutoff: created_at < 2026-08-01 00:00:00 Africa/Casablanca
-- ============================================================================

WITH cutoff AS (
  SELECT ('2026-08-01'::timestamp AT TIME ZONE 'Africa/Casablanca') AS ts
)
SELECT metric, n
FROM cutoff,
LATERAL (
  VALUES
    ('tasks_before_cutoff_must_be_0', (SELECT count(*) FROM public.tasks t WHERE t.created_at < cutoff.ts)),
    ('videos_before_cutoff_must_be_0', (SELECT count(*) FROM public.videos v WHERE v.created_at < cutoff.ts)),
    ('tasks_remaining', (SELECT count(*) FROM public.tasks)),
    ('videos_remaining', (SELECT count(*) FROM public.videos)),
    ('clients', (SELECT count(*) FROM public.clients)),
    ('quotes', (SELECT count(*) FROM public.quotes)),
    ('employees', (SELECT count(*) FROM public.employees)),
    ('discord_channel_routes', (SELECT count(*) FROM public.discord_channel_routes)),
    ('client_portals', (SELECT count(*) FROM public.client_portals)),
    ('task_discord_messages', (SELECT count(*) FROM public.task_discord_messages))
) AS x(metric, n);
