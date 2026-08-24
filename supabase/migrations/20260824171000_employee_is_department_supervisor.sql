-- Supervision is a management flag, not a job function.
-- employees.role stays the métier; employees.department stays the pole.

alter table public.employees
  add column if not exists is_department_supervisor boolean not null default false;

comment on column public.employees.is_department_supervisor is
  'Management responsibility for employees.department. Independent of employees.role (métier).';

create index if not exists idx_employees_is_department_supervisor
  on public.employees (department)
  where is_department_supervisor;

update public.employees
set is_department_supervisor = true
where role = 'department_supervisor'::public.user_role
  and not is_department_supervisor;

update public.employees e
set role = coalesce(
  (
    select skill
    from unnest(e.operational_skills) as skill
    where skill in (
      'editor'::public.user_role,
      'cameraman'::public.user_role,
      'developer'::public.user_role,
      'designer'::public.user_role,
      'seo'::public.user_role,
      'community_manager'::public.user_role,
      'commercial'::public.user_role
    )
    limit 1
  ),
  case e.department
    when 'production_video'::public.task_department then 'editor'::public.user_role
    when 'video_distribution'::public.task_department then 'editor'::public.user_role
    when 'community_management'::public.task_department then 'community_manager'::public.user_role
    when 'media_buying'::public.task_department then 'commercial'::public.user_role
    when 'web_seo'::public.task_department then 'developer'::public.user_role
    else 'editor'::public.user_role
  end
)
where e.role = 'department_supervisor'::public.user_role;

create or replace function public.employees_enforce_update_rls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role user_role;
  jwt_role text;
begin
  jwt_role := coalesce(auth.jwt() ->> 'role', '');
  if jwt_role = 'service_role' or auth.role() = 'service_role' then
    return new;
  end if;

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
     or new.department is distinct from old.department
     or new.is_department_supervisor is distinct from old.is_department_supervisor
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email
     or new.user_id is distinct from old.user_id
     or new.archived_at is distinct from old.archived_at
     or new.notes_internal is distinct from old.notes_internal
     or new.full_name is distinct from old.full_name
     or new.hire_date is distinct from old.hire_date
     or new.manager_id is distinct from old.manager_id
     or new.operational_skills is distinct from old.operational_skills
     or new.must_change_password is distinct from old.must_change_password
  then
    raise exception 'Seuls les administrateurs peuvent modifier ces champs.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.auth_is_department_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and e.department is not null
      and (
        e.is_department_supervisor
        or e.role = 'department_supervisor'::public.user_role
      )
  );
$$;

create or replace function public.auth_staff_task_visible(p_task_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  r public.user_role;
  ae uuid;
  is_sup boolean;
  dept public.task_department;
  t record;
begin
  select e.role, e.id, e.is_department_supervisor, e.department
    into r, ae, is_sup, dept
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;

  if r is null or ae is null then
    return false;
  end if;

  select * into t from public.tasks where id = p_task_id;
  if not found then
    return false;
  end if;

  if r in ('admin'::public.user_role, 'project_manager'::public.user_role) then
    return true;
  end if;

  if (coalesce(is_sup, false) or r = 'department_supervisor'::public.user_role)
     and t.department is not null
     and t.department = dept then
    return true;
  end if;

  if r in ('finance'::public.user_role, 'commercial'::public.user_role) then
    return false;
  end if;

  if t.assignee_id = ae or ae = any (t.watcher_ids) then
    return true;
  end if;

  if exists (
    select 1 from public.task_assignments ta
    where ta.task_id = t.id and ta.employee_id = ae
  ) then
    return true;
  end if;

  if t.video_id is not null and public.auth_staff_video_visible(t.video_id) then
    if r in ('editor'::public.user_role, 'cameraman'::public.user_role, 'community_manager'::public.user_role) then
      return true;
    end if;
  end if;

  if t.project_id is not null and public.auth_staff_project_visible(t.project_id) then
    if r in ('developer'::public.user_role, 'designer'::public.user_role, 'seo'::public.user_role) then
      return true;
    end if;
  end if;

  if t.internal_project_id is not null and public.auth_staff_internal_project_visible(t.internal_project_id) then
    if r in ('developer'::public.user_role, 'designer'::public.user_role, 'seo'::public.user_role) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.auth_staff_client_visible(p_client_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  r public.user_role;
  ae uuid;
  is_sup boolean;
begin
  if p_client_id is null then
    return false;
  end if;

  select e.role, e.id, e.is_department_supervisor
    into r, ae, is_sup
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;

  if r is null or ae is null then
    return false;
  end if;

  if r in (
    'admin'::public.user_role,
    'project_manager'::public.user_role
  ) or coalesce(is_sup, false)
    or r = 'department_supervisor'::public.user_role then
    return true;
  end if;

  if r = 'finance'::public.user_role then
    return exists (select 1 from public.invoices i where i.client_id = p_client_id)
      or exists (select 1 from public.quotes q where q.client_id = p_client_id)
      or exists (select 1 from public.payments p where p.client_id = p_client_id);
  end if;

  if r = 'commercial'::public.user_role then
    return exists (
      select 1 from public.clients c
      where c.id = p_client_id and c.account_manager_id = ae
    );
  end if;

  if r in ('editor'::public.user_role, 'cameraman'::public.user_role, 'community_manager'::public.user_role) then
    return exists (
      select 1 from public.videos v
      where v.client_id = p_client_id
        and (
          v.editor_id = ae or v.cameraman_id = ae
          or exists (
            select 1 from public.video_assignments va
            where va.video_id = v.id and va.employee_id = ae
          )
        )
    )
    or exists (
      select 1 from public.tasks t
      where t.client_id = p_client_id
        and (
          t.assignee_id = ae or ae = any (t.watcher_ids)
          or exists (
            select 1 from public.task_assignments ta
            where ta.task_id = t.id and ta.employee_id = ae
          )
        )
    );
  end if;

  if r in ('developer'::public.user_role, 'designer'::public.user_role, 'seo'::public.user_role) then
    if r = 'seo'::public.user_role then
      return exists (
        select 1 from public.projects p
        where p.client_id = p_client_id
          and p.type ilike '%seo%'
          and (p.lead_id = ae or ae = any (p.team_ids))
      );
    end if;
    return exists (
      select 1 from public.projects p
      where p.client_id = p_client_id
        and (p.lead_id = ae or ae = any (p.team_ids))
    );
  end if;

  return false;
end;
$$;
