-- ============================================================================
-- DRY-RUN — reset métier complet (lecture seule)
-- ============================================================================
-- Aucun DELETE / UPDATE / INSERT. Exécuter dans SQL Editor avant la migration.
-- Voir : supabase/migrations/20260516120000_business_data_full_reset_keep_team.sql
-- ============================================================================

SELECT 'clients_count' AS metric, count(*)::bigint AS n FROM public.clients
UNION ALL SELECT 'projects_count', count(*) FROM public.projects
UNION ALL SELECT 'internal_projects_count', count(*) FROM public.internal_projects
UNION ALL SELECT 'tasks_count', count(*) FROM public.tasks
UNION ALL SELECT 'videos_count', count(*) FROM public.videos
UNION ALL SELECT 'editorial_calendars_count', count(*) FROM public.editorial_calendars
UNION ALL SELECT 'quotes_count', count(*) FROM public.quotes
UNION ALL SELECT 'quote_items_count', count(*) FROM public.quote_items
UNION ALL SELECT 'invoices_count', count(*) FROM public.invoices
UNION ALL SELECT 'invoice_items_count', count(*) FROM public.invoice_items
UNION ALL SELECT 'payments_count', count(*) FROM public.payments
UNION ALL SELECT 'documents_count', count(*) FROM public.documents
UNION ALL SELECT 'reports_count', count(*) FROM public.reports
UNION ALL SELECT 'content_ideas_count', count(*) FROM public.content_ideas
UNION ALL SELECT 'client_portals_count', count(*) FROM public.client_portals
UNION ALL SELECT 'comments_all_count', count(*) FROM public.comments
UNION ALL SELECT 'notifications_count', count(*) FROM public.notifications
UNION ALL SELECT 'activity_logs_count', count(*) FROM public.activity_logs
UNION ALL SELECT 'employees_count_kept', count(*) FROM public.employees
UNION ALL SELECT 'agency_settings_rows_kept', count(*) FROM public.agency_settings
UNION ALL SELECT 'user_notification_preferences_kept', count(*) FROM public.user_notification_preferences
UNION ALL SELECT 'video_templates_kept', count(*) FROM public.video_templates;

-- Commentaires « métier » (types connus)
SELECT 'comments_business_count' AS metric, count(*)::bigint AS n
FROM public.comments
WHERE entity_type IN ('task', 'video', 'project', 'client', 'invoice', 'quote', 'document', 'report');

-- Notifications / activité métier (même filtre que la migration — le reste est conservé)
SELECT 'notifications_business_count' AS metric, count(*)::bigint AS n
FROM public.notifications
WHERE related_entity_type IN (
  'task', 'video', 'project', 'client', 'invoice', 'quote', 'document', 'report',
  'payment', 'client_portal'
);

SELECT 'activity_logs_business_count' AS metric, count(*)::bigint AS n
FROM public.activity_logs
WHERE entity_type IN (
  'task', 'video', 'project', 'client', 'invoice', 'quote', 'document', 'report',
  'payment', 'client_portal'
);

-- Une ligne portail = un token (pas de table portal_tokens séparée)
SELECT 'portal_tokens_count' AS metric, count(*)::bigint AS n FROM public.client_portals;

-- Échantillons (10 lignes max par table)
SELECT 'sample_clients' AS src, id::text, left(name, 60) AS title FROM public.clients ORDER BY name LIMIT 10;
SELECT 'sample_projects' AS src, id::text, left(title, 60) FROM public.projects ORDER BY updated_at DESC LIMIT 10;
SELECT 'sample_tasks' AS src, id::text, left(title, 60) FROM public.tasks ORDER BY updated_at DESC LIMIT 10;
SELECT 'sample_videos' AS src, id::text, left(title, 60) FROM public.videos ORDER BY updated_at DESC LIMIT 10;
SELECT 'sample_invoices' AS src, id::text, ref FROM public.invoices ORDER BY created_at DESC LIMIT 10;
SELECT 'sample_quotes' AS src, id::text, ref FROM public.quotes ORDER BY created_at DESC LIMIT 10;
SELECT 'sample_documents' AS src, id::text, left(name, 60) FROM public.documents ORDER BY uploaded_at DESC LIMIT 10;
SELECT 'sample_reports' AS src, id::text, left(title, 60) FROM public.reports ORDER BY created_at DESC LIMIT 10;
