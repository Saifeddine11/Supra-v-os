-- ============================================================================
-- Agency OS — Nettoyage données démo + clients / équipe / projets internes réels
-- ============================================================================
-- AVANT D’EXÉCUTER :
--   - Sauvegarde complète (Supabase backup ou pg_dump).
--   - Exécuter supabase/dry-run/production-data-cleanup-preview.sql (SELECT uniquement).
--   - Ce script est conçu pour UNE exécution principale : un second passage re-supprime
--     toutes les tâches, vidéos, calendriers et projets internes (nucléaire).
--
-- ORDRE AVEC LES AUTRES MIGRATIONS :
--   1) 20260514180000 (ce fichier) — données
--   2) 20260515120000_employees_must_change_password.sql — colonne + trigger
--      (indépendant ; peut aussi être appliqué avant sans conflit avec ce fichier)
--
-- NE MODIFIE PAS : auth.users, invoices, quotes, payments, reports (lignes),
-- employés non ciblés par les UPDATE/INSERT ci-dessous.
--
-- clients.email : nullable dans schema.sql — les INSERT n’ont pas besoin d’e-mail.
--   Si votre base a une contrainte NOT NULL sur clients.email, ajoutez les e-mails
--   d’invitation avant INSERT ou étendez les INSERT (voir commentaire section 7).
--
-- user_role : la valeur 'finance' existe déjà dans l’enum (operational_skills Mounir).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Commentaires : tâches & vidéos (entités entièrement supprimées)
--     Les commentaires de type « project » pour projets ARCHIVÉS sont conservés.
--     Seuls les commentaires des projets effectivement SUPPRIMÉS sont effacés (étape 5b).
-- ---------------------------------------------------------------------------
DELETE FROM comments
WHERE entity_type IN ('task', 'video');

-- ---------------------------------------------------------------------------
-- 2) Tâches — vidage complet
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  n int;
BEGIN
  LOOP
    DELETE FROM tasks
    WHERE id IN (
      SELECT t.id
      FROM tasks t
      WHERE NOT EXISTS (SELECT 1 FROM tasks c WHERE c.parent_task_id = t.id)
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN n = 0;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Vidéos + calendriers éditoriaux
-- ---------------------------------------------------------------------------
DELETE FROM videos;
DELETE FROM editorial_calendars;

-- ---------------------------------------------------------------------------
-- 4) Projets internes — tout supprimer puis graines réelles (idempotent sur titres)
-- ---------------------------------------------------------------------------
DELETE FROM internal_projects;

-- ---------------------------------------------------------------------------
-- 5) Projets clients
--     5a) Archiver si facture ou document lié (évite DELETE CASCADE sur documents)
--     5b) Commentaires « project » uniquement pour les IDs supprimables
--     5c) Supprimer les projets sans lien facture/document
-- ---------------------------------------------------------------------------
UPDATE projects p
SET
  status = 'archived'::project_status,
  notes_internal =
    CASE
      WHEN p.notes_internal IS NULL OR btrim(p.notes_internal) = '' THEN
        '[Nettoyage 2026] Archivé automatiquement (facture ou document lié au projet).'
      ELSE
        p.notes_internal || E'\n[Nettoyage 2026] Archivé automatiquement (facture ou document lié au projet).'
    END,
  updated_at = now()
WHERE EXISTS (SELECT 1 FROM invoices i WHERE i.project_id = p.id)
   OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = p.invoice_id)
   OR EXISTS (SELECT 1 FROM documents d WHERE d.project_id = p.id);

DELETE FROM comments
WHERE entity_type = 'project'
  AND entity_id IN (
    SELECT p.id
    FROM projects p
    WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.project_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = p.invoice_id)
      AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.project_id = p.id)
  );

DELETE FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.project_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = p.invoice_id)
  AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.project_id = p.id);

-- ---------------------------------------------------------------------------
-- 6) Clients démo
-- ---------------------------------------------------------------------------
DELETE FROM clients c
WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM projects pr WHERE pr.client_id = c.id)
  AND lower(btrim(c.name)) NOT IN (
    'emara estates',
    'emma estates',
    'africa beauty',
    'chat immobilier'
  );

-- ---------------------------------------------------------------------------
-- 7) Clients réels — upsert
--     Colonne email : nullable dans le schéma référence. Si NOT NULL en prod, décommenter :
--     , email = 'emara.estates@invite.agency-os.local' dans INSERT/UPDATE.
-- ---------------------------------------------------------------------------
UPDATE clients
SET
  name = 'Emara Estates',
  sector = 'Immobilier / agence immobilière',
  status = 'active'::client_status,
  start_date = DATE '2026-04-01',
  notes_internal =
    'Collaboration commencée le 1er avril 2026, toujours en cours. On travaille avec eux depuis environ un mois et demi.',
  updated_at = now()
WHERE lower(btrim(name)) IN ('emara estates', 'emma estates');

INSERT INTO clients (name, sector, status, start_date, notes_internal, contract_type, country)
SELECT
  'Emara Estates',
  'Immobilier / agence immobilière',
  'active'::client_status,
  DATE '2026-04-01',
  'Collaboration commencée le 1er avril 2026, toujours en cours. On travaille avec eux depuis environ un mois et demi.',
  'monthly'::contract_type,
  'Maroc'
WHERE NOT EXISTS (
  SELECT 1 FROM clients WHERE lower(btrim(name)) IN ('emara estates', 'emma estates')
);

UPDATE clients
SET
  sector = 'Beauté / salon / coiffure',
  status = 'active'::client_status,
  start_date = DATE '2026-05-01',
  notes_internal = 'Collaboration commencée le 1er mai 2026.',
  updated_at = now()
WHERE lower(btrim(name)) = 'africa beauty';

INSERT INTO clients (name, sector, status, start_date, notes_internal, contract_type, country)
SELECT
  'Africa Beauty',
  'Beauté / salon / coiffure',
  'active'::client_status,
  DATE '2026-05-01',
  'Collaboration commencée le 1er mai 2026.',
  'monthly'::contract_type,
  'Maroc'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE lower(btrim(name)) = 'africa beauty');

UPDATE clients
SET
  sector = 'Immobilier',
  status = 'active'::client_status,
  start_date = DATE '2026-03-01',
  notes_internal =
    'Client immobilier, collaboration en cours depuis environ deux mois.',
  updated_at = now()
WHERE lower(btrim(name)) = 'chat immobilier';

INSERT INTO clients (name, sector, status, start_date, notes_internal, contract_type, country)
SELECT
  'Chat Immobilier',
  'Immobilier',
  'active'::client_status,
  DATE '2026-03-01',
  'Client immobilier, collaboration en cours depuis environ deux mois.',
  'monthly'::contract_type,
  'Maroc'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE lower(btrim(name)) = 'chat immobilier');

-- ---------------------------------------------------------------------------
-- 8) Équipe — upsert ciblé (n’efface pas les autres employés ni auth.users)
-- ---------------------------------------------------------------------------
UPDATE employees
SET
  role = 'project_manager'::user_role,
  operational_skills = ARRAY['project_manager']::user_role[],
  notes_internal =
    'Assistante administrative — coordination tâches, calendrier, suivi clients/projets et organisation équipe.',
  is_active = true,
  archived_at = null,
  updated_at = now()
WHERE lower(btrim(full_name)) = 'meryem halli';

INSERT INTO employees (
  full_name,
  email,
  role,
  operational_skills,
  notes_internal,
  is_active
)
SELECT
  'Meryem Halli',
  'meryem.halli@invite.agency-os.local',
  'project_manager'::user_role,
  ARRAY['project_manager']::user_role[],
  'Assistante administrative — coordination tâches, calendrier, suivi clients/projets et organisation équipe.',
  true
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE lower(btrim(full_name)) = 'meryem halli');

UPDATE employees
SET
  role = 'commercial'::user_role,
  operational_skills = ARRAY['commercial', 'finance']::user_role[],
  notes_internal = 'Commercial avec participation au suivi finance.',
  is_active = true,
  archived_at = null,
  updated_at = now()
WHERE lower(btrim(full_name)) = 'mounir boutayeb';

INSERT INTO employees (
  full_name,
  email,
  role,
  operational_skills,
  notes_internal,
  is_active
)
SELECT
  'Mounir Boutayeb',
  'mounir.boutayeb@invite.agency-os.local',
  'commercial'::user_role,
  ARRAY['commercial', 'finance']::user_role[],
  'Commercial avec participation au suivi finance.',
  true
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE lower(btrim(full_name)) = 'mounir boutayeb');

UPDATE employees
SET
  role = 'community_manager'::user_role,
  operational_skills = ARRAY['community_manager']::user_role[],
  notes_internal = 'Rédaction scripts / contenus.',
  is_active = true,
  archived_at = null,
  updated_at = now()
WHERE lower(btrim(full_name)) = 'louis'
  AND btrim(full_name) !~ '\s';

INSERT INTO employees (
  full_name,
  email,
  role,
  operational_skills,
  notes_internal,
  is_active
)
SELECT
  'Louis',
  'louis@invite.agency-os.local',
  'community_manager'::user_role,
  ARRAY['community_manager']::user_role[],
  'Rédaction scripts / contenus.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM employees WHERE lower(btrim(full_name)) = 'louis' AND btrim(full_name) !~ '\s'
);

UPDATE employees
SET
  role = 'editor'::user_role,
  operational_skills = ARRAY['editor', 'cameraman']::user_role[],
  notes_internal = 'Monteur et caméraman.',
  is_active = true,
  archived_at = null,
  updated_at = now()
WHERE lower(btrim(full_name)) = 'julien'
  AND btrim(full_name) !~ '\s';

INSERT INTO employees (
  full_name,
  email,
  role,
  operational_skills,
  notes_internal,
  is_active
)
SELECT
  'Julien',
  'julien@invite.agency-os.local',
  'editor'::user_role,
  ARRAY['editor', 'cameraman']::user_role[],
  'Monteur et caméraman.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM employees WHERE lower(btrim(full_name)) = 'julien' AND btrim(full_name) !~ '\s'
);

-- ---------------------------------------------------------------------------
-- 9) Projets internes — graines (idempotent si relance partielle : pas de doublon de titre)
-- ---------------------------------------------------------------------------
INSERT INTO internal_projects (title, description, category, status, priority, progress)
SELECT v.title, v.description, v.category, v.status, v.priority, v.progress
FROM (
  VALUES
    (
      'Mavericks Immobilier',
      'Projet interne lié à l''immobilier.',
      'Immobilier',
      'in_progress'::project_status,
      'normal'::internal_priority,
      0
    ),
    (
      'Real Estate Vision',
      'Projet interne lié à la vision / stratégie immobilière.',
      'Immobilier',
      'in_progress'::project_status,
      'normal'::internal_priority,
      0
    )
) AS v(title, description, category, status, priority, progress)
WHERE NOT EXISTS (
  SELECT 1
  FROM internal_projects e
  WHERE lower(btrim(e.title)) = lower(btrim(v.title))
);

COMMIT;
