-- =============================================================================
-- Tests RLS — Supra v. Agency OS (staging / SQL Editor)
-- =============================================================================
-- À exécuter avec une session impersonnant le JWT du collaborateur de test
-- (rôle authenticated). Remplacez les UUID par des IDs réels.
--
-- Voir aussi : docs/security/rls-test-plan.md
-- =============================================================================

-- Sanity : helpers présents
select proname
from pg_proc
where proname like 'auth\_staff\_%' escape '\'
   or proname like 'auth\_is\_%' escape '\'
   or proname in (
     'auth_user_role',
     'auth_employee_id',
     'auth_can_view_global_finance',
     'auth_is_admin_or_pm'
   )
order by 1;

-- Exemples de vérifs fonctionnelles (décommenter avec de vrais UUID) :
-- select public.auth_staff_client_visible('00000000-0000-0000-0000-000000000001'::uuid);
-- select public.auth_staff_task_visible('…'::uuid);
-- select public.auth_staff_video_visible('…'::uuid);

-- Editor : aucune facture
-- select count(*) from public.invoices;
-- attendu : 0

-- Editor : aucun paiement
-- select count(*) from public.payments;
-- attendu : 0

-- PM : aucun paiement
-- select count(*) from public.payments;
-- attendu : 0

-- PM : pas d'objectifs CA globaux
-- select count(*) from public.agency_monthly_goals;
-- attendu : 0

-- Notifications : pas de lignes d'autres utilisateurs (sauf si admin)
-- select recipient_user_id, count(*) from public.notifications group by 1;
