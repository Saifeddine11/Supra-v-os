-- ============================================================================
-- DRY-RUN / PRÉVISUALISATION — NE PAS EXÉCUTER EN PROD COMME MIGRATION
-- ============================================================================
-- Usage : SQL Editor Supabase (lecture seule) — uniquement des SELECT.
-- Voir : supabase/migrations/20260514180000_agency_os_production_data_cleanup.sql
-- ============================================================================

-- --- Comptages globaux (avant action) ---
SELECT 'tasks_total' AS section, count(*)::bigint AS n FROM public.tasks
UNION ALL SELECT 'videos_total', count(*) FROM public.videos
UNION ALL SELECT 'editorial_calendars_total', count(*) FROM public.editorial_calendars
UNION ALL SELECT 'internal_projects_total', count(*) FROM public.internal_projects
UNION ALL SELECT 'projects_total', count(*) FROM public.projects
UNION ALL SELECT 'clients_total', count(*) FROM public.clients
UNION ALL SELECT 'comments_task_video', count(*) FROM public.comments
WHERE entity_type IN ('task', 'video')
UNION ALL SELECT 'comments_project_all', count(*) FROM public.comments
WHERE entity_type = 'project';

-- --- Tâches : tout sera supprimé (arbre parent/enfant) ---
SELECT 'tasks_to_delete' AS section, count(*)::bigint AS n FROM public.tasks;

-- --- Vidéos & calendriers : tout supprimé ---
SELECT 'videos_to_delete' AS section, count(*)::bigint AS n FROM public.videos;
SELECT 'editorial_calendars_to_delete' AS section, count(*)::bigint AS n FROM public.editorial_calendars;

-- --- Projets internes : tout supprimé puis 2 graines ré-insérées ---
SELECT 'internal_projects_to_delete' AS section, count(*)::bigint AS n FROM public.internal_projects;

-- --- Projets clients : archive vs suppression (même logique que la migration) ---
WITH guarded AS (
  SELECT p.id
  FROM public.projects p
  WHERE EXISTS (SELECT 1 FROM public.invoices i WHERE i.project_id = p.id)
     OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = p.invoice_id)
     OR EXISTS (SELECT 1 FROM public.documents d WHERE d.project_id = p.id)
),
deletable AS (
  SELECT p.id
  FROM public.projects p
  WHERE NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.project_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = p.invoice_id)
    AND NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.project_id = p.id)
)
SELECT 'projects_to_archive' AS section, (SELECT count(*)::bigint FROM guarded)
UNION ALL
SELECT 'projects_to_delete', (SELECT count(*)::bigint FROM deletable);

-- Détail optionnel (limité) : projets à archiver
SELECT p.id, p.title, p.client_id, p.status
FROM public.projects p
WHERE EXISTS (SELECT 1 FROM public.invoices i WHERE i.project_id = p.id)
   OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = p.invoice_id)
   OR EXISTS (SELECT 1 FROM public.documents d WHERE d.project_id = p.id)
ORDER BY p.title
LIMIT 50;

-- Détail optionnel : projets supprimables
SELECT p.id, p.title, p.client_id
FROM public.projects p
WHERE NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.project_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = p.invoice_id)
  AND NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.project_id = p.id)
ORDER BY p.title
LIMIT 50;

-- Commentaires « project » qui seraient supprimés (même sous-ensemble que la migration)
SELECT 'comments_project_to_delete' AS section, count(*)::bigint AS n
FROM public.comments c
WHERE c.entity_type = 'project'
  AND c.entity_id IN (
    SELECT p.id
    FROM public.projects p
    WHERE NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.project_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = p.invoice_id)
      AND NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.project_id = p.id)
  );

-- --- Clients : suppression démo (même filtre que la migration) ---
WITH keep_names AS (
  SELECT unnest(ARRAY[
    'emara estates', 'emma estates', 'africa beauty', 'chat immobilier'
  ]) AS name_key
),
to_delete AS (
  SELECT c.id, c.name
  FROM public.clients c
  WHERE NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.reports r WHERE r.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.projects pr WHERE pr.client_id = c.id)
    AND lower(btrim(c.name)) NOT IN (SELECT name_key FROM keep_names)
),
to_keep AS (
  SELECT c.id, c.name
  FROM public.clients c
  WHERE EXISTS (SELECT 1 FROM public.invoices i WHERE i.client_id = c.id)
     OR EXISTS (SELECT 1 FROM public.quotes q WHERE q.client_id = c.id)
     OR EXISTS (SELECT 1 FROM public.payments p WHERE p.client_id = c.id)
     OR EXISTS (SELECT 1 FROM public.reports r WHERE r.client_id = c.id)
     OR EXISTS (SELECT 1 FROM public.projects pr WHERE pr.client_id = c.id)
     OR lower(btrim(c.name)) IN (SELECT name_key FROM keep_names)
)
SELECT 'clients_to_delete_count' AS section, (SELECT count(*)::bigint FROM to_delete)
UNION ALL
SELECT 'clients_to_keep_count', (SELECT count(*)::bigint FROM to_keep);

WITH keep_names AS (
  SELECT unnest(ARRAY[
    'emara estates', 'emma estates', 'africa beauty', 'chat immobilier'
  ]) AS name_key
),
to_delete AS (
  SELECT c.id, c.name
  FROM public.clients c
  WHERE NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.reports r WHERE r.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.projects pr WHERE pr.client_id = c.id)
    AND lower(btrim(c.name)) NOT IN (SELECT name_key FROM keep_names)
)
SELECT 'clients_to_delete_sample' AS kind, id, name FROM to_delete ORDER BY name LIMIT 30;

-- --- Employés : lignes qui seraient touchées par UPDATE / INSERT ---
SELECT 'employees_meryem' AS target, id, full_name, email, role FROM public.employees
WHERE lower(btrim(full_name)) = 'meryem halli'
UNION ALL
SELECT 'employees_mounir', id, full_name, email, role FROM public.employees
WHERE lower(btrim(full_name)) = 'mounir boutayeb'
UNION ALL
SELECT 'employees_louis', id, full_name, email, role FROM public.employees
WHERE lower(btrim(full_name)) = 'louis' AND btrim(full_name) !~ '\s'
UNION ALL
SELECT 'employees_julien', id, full_name, email, role FROM public.employees
WHERE lower(btrim(full_name)) = 'julien' AND btrim(full_name) !~ '\s';

-- --- Clients cibles (upsert) ---
SELECT 'client_emara_match' AS k, id, name, email, status FROM public.clients
WHERE lower(btrim(name)) IN ('emara estates', 'emma estates');
SELECT 'client_africa_match' AS k, id, name, email, status FROM public.clients
WHERE lower(btrim(name)) = 'africa beauty';
SELECT 'client_chat_match' AS k, id, name, email, status FROM public.clients
WHERE lower(btrim(name)) = 'chat immobilier';

-- --- Projets internes après migration : 2 titres attendus (après exécution seulement) ---
SELECT 'internal_projects_seed_titles' AS info, title FROM public.internal_projects
WHERE lower(btrim(title)) IN ('mavericks immobilier', 'real estate vision');

-- --- auth.users : non lu par RLS anonyme ; ne pas compter depuis client restreint ---
-- La migration ne touche pas auth.users.
