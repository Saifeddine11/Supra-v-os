-- ============================================================================
-- Lier les lignes `employees` aux comptes Supabase Auth (auth.users)
-- ============================================================================
-- À exécuter dans Supabase → SQL Editor (rôle postgres / service).
-- Le seed du projet crée des employés avec user_id NULL ; sans liaison,
-- /api/auth/login refusera la connexion (aucun profil employé).
-- ============================================================================

-- 1) Diagnostic : employés sans compte Auth lié
-- select id, full_name, email, role, user_id from public.employees order by email;

-- 2) Diagnostic : utilisateurs Auth (email confirmé ?)
-- select id, email, email_confirmed_at, created_at from auth.users order by created_at desc;

-- 3) Lier automatiquement par e-mail (insensible à la casse)
update public.employees e
set user_id = u.id,
    updated_at = now()
from auth.users u
where lower(trim(u.email)) = lower(trim(e.email))
  and e.user_id is distinct from u.id;

-- 4) Vérifier qu’un admin a bien user_id + rôle
-- select e.id, e.email, e.role, e.user_id, u.email as auth_email
-- from public.employees e
-- left join auth.users u on u.id = e.user_id
-- where e.role = 'admin';
