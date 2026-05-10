-- ============================================================================
-- DESTRUCTIF — reset complet des données métier (CONSERVE équipe & auth & settings)
-- ============================================================================
-- Supprime : clients, portails, projets, tâches, vidéos, éditorial, devis, factures,
--            paiements, rapports, documents, idées contenu, commentaires, notifications,
--            journaux d’activité.
--
-- CONSERVE :
--   - public.employees (aucune modification)
--   - auth.users (non touché par ce script)
--   - public.agency_settings
--   - public.user_notification_preferences
--   - public.video_templates (catalogue secteurs, pas données client)
--
-- NE supprime PAS les fichiers Supabase Storage — vider les buckets manuellement si besoin
--   (documents, deliverables, reports, quotes, invoices — voir rapport projet).
--
-- Prérequis : sauvegarde / backup. Exécuter après dry-run :
--   supabase/dry-run/full-business-reset-preview.sql
--
-- Ordre dicté par les FK (RESTRICT sur clients pour invoices/quotes/payments).
-- ============================================================================

BEGIN;

-- 1) Commentaires métier (polymorphe : task, video, project, client, etc.)
DELETE FROM public.comments;

-- Notifications : ne supprimer que les lignes liées au domaine métier (garder résumés / system sans related_entity)
DELETE FROM public.notifications
WHERE related_entity_type IN (
  'task', 'video', 'project', 'client', 'invoice', 'quote', 'document', 'report',
  'payment', 'client_portal'
);

-- Journaux : garder entity_type = 'employee' (audit équipe)
DELETE FROM public.activity_logs
WHERE entity_type IN (
  'task', 'video', 'project', 'client', 'invoice', 'quote', 'document', 'report',
  'payment', 'client_portal'
);

-- 2) Finance : payments avant invoices (FK RESTRICT)
DELETE FROM public.payments;

-- 3) Factures & lignes (CASCADE invoice_items)
DELETE FROM public.invoice_items;
DELETE FROM public.invoices;

-- 4) Devis & lignes (converted_invoice_id → invoices : déjà nuls après suppression factures)
DELETE FROM public.quote_items;
DELETE FROM public.quotes;

-- 5) Rapports & documents
DELETE FROM public.reports;
DELETE FROM public.documents;

-- 6) Tâches (parent → feuilles)
DO $$
DECLARE
  n int;
BEGIN
  LOOP
    DELETE FROM public.tasks
    WHERE id IN (
      SELECT t.id
      FROM public.tasks t
      WHERE NOT EXISTS (SELECT 1 FROM public.tasks c WHERE c.parent_task_id = t.id)
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN n = 0;
  END LOOP;
END $$;

-- 7) Idées contenu (avant vidéos/clients si liées)
DELETE FROM public.content_ideas;

-- 8) Vidéos puis calendriers éditoriaux
DELETE FROM public.videos;
DELETE FROM public.editorial_calendars;

-- 9) Projets internes puis projets clients
DELETE FROM public.internal_projects;
DELETE FROM public.projects;

-- 10) Portails puis clients (portails : CASCADE si clients supprimés — explicite pour clarté)
DELETE FROM public.client_portals;
DELETE FROM public.clients;

COMMIT;
