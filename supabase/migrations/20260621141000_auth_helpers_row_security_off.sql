-- Évite que la RLS sur employees bloque auth_user_role / auth_employee_id dans les policies.

create or replace function public.auth_user_role()
returns public.user_role
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare r public.user_role;
begin
  select e.role into r
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;
  return r;
end;
$$;

create or replace function public.auth_employee_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare e uuid;
begin
  select emp.id into e
  from public.employees emp
  where emp.user_id = auth.uid()
  limit 1;
  return e;
end;
$$;

create or replace function public.auth_is_admin_or_pm()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.auth_user_role() in (
    'admin'::public.user_role,
    'project_manager'::public.user_role
  );
$$;
