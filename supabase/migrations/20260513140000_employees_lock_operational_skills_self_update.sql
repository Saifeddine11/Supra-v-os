-- Les compétences opérationnelles ne peuvent être modifiées que par un admin (pas en self-service via le client Supabase).

create or replace function public.employees_enforce_update_rls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role user_role;
begin
  select e.role into actor_role
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;

  if actor_role = 'admin' then
    return new;
  end if;

  if old.user_id is null or old.user_id <> auth.uid() then
    raise exception 'Mise à jour non autorisée' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email
     or new.user_id is distinct from old.user_id
     or new.archived_at is distinct from old.archived_at
     or new.notes_internal is distinct from old.notes_internal
     or new.full_name is distinct from old.full_name
     or new.hire_date is distinct from old.hire_date
     or new.manager_id is distinct from old.manager_id
     or new.operational_skills is distinct from old.operational_skills
  then
    raise exception 'Seuls les administrateurs peuvent modifier ces champs.' using errcode = '42501';
  end if;

  return new;
end;
$$;
