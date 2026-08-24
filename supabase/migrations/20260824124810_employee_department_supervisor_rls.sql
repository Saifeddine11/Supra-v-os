-- Employee canonical pole (same enum as tasks.department) + department supervisor RLS.
-- Scope is always employees.department / tasks.department — no mapping table.

alter table public.employees
  add column if not exists department public.task_department;

comment on column public.employees.department is
  'Canonical pole. Department supervisors manage employees and tasks that share this value.';

create index if not exists idx_employees_department on public.employees (department);

-- Backfill from existing job roles. Unmapped roles (admin, PM, finance, commercial) stay null.
update public.employees
set department = case role
  when 'community_manager'::public.user_role then 'community_management'::public.task_department
  when 'editor'::public.user_role then 'production_video'::public.task_department
  when 'cameraman'::public.user_role then 'production_video'::public.task_department
  when 'developer'::public.user_role then 'web_seo'::public.task_department
  when 'designer'::public.user_role then 'web_seo'::public.task_department
  when 'seo'::public.user_role then 'web_seo'::public.task_department
  else department
end
where department is null;

-- Lock department on self-update (Direction/admin only, same as role).
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

create or replace function public.auth_employee_department()
returns public.task_department
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare d public.task_department;
begin
  select e.department into d
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;
  return d;
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
  select public.auth_user_role() = 'department_supervisor'::public.user_role
    and public.auth_employee_department() is not null;
$$;

create or replace function public.auth_can_supervise_department(p_department public.task_department)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    public.auth_is_admin_or_pm()
    or (
      public.auth_is_department_supervisor()
      and p_department is not null
      and p_department = public.auth_employee_department()
    );
$$;

revoke all on function public.auth_employee_department() from public;
grant execute on function public.auth_employee_department() to authenticated;
revoke all on function public.auth_is_department_supervisor() from public;
grant execute on function public.auth_is_department_supervisor() to authenticated;
revoke all on function public.auth_can_supervise_department(public.task_department) from public;
grant execute on function public.auth_can_supervise_department(public.task_department) to authenticated;

-- Tasks: supervisor sees every task of their pole, including unassigned.
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
  t record;
begin
  select e.role, e.id into r, ae
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

  if r = 'department_supervisor'::public.user_role
     and t.department is not null
     and t.department = public.auth_employee_department() then
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

-- Supervisor may attach a department task to any client (no finance tables).
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
begin
  if p_client_id is null then
    return false;
  end if;

  select e.role, e.id into r, ae
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;

  if r is null or ae is null then
    return false;
  end if;

  if r in (
    'admin'::public.user_role,
    'project_manager'::public.user_role,
    'department_supervisor'::public.user_role
  ) then
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

drop policy if exists "employees_select_scoped" on public.employees;
create policy "employees_select_scoped"
  on public.employees for select
  to authenticated
  using (
    public.auth_is_admin()
    or public.auth_user_role() = 'project_manager'::public.user_role
    or (
      public.auth_is_department_supervisor()
      and public.employees.department is not null
      and public.employees.department = public.auth_employee_department()
    )
    or public.employees.user_id = auth.uid()
    or public.employees.id = public.auth_employee_id()
    or (
      public.auth_user_role() = 'finance'::public.user_role
      and public.employees.id = public.auth_employee_id()
    )
    or exists (
      select 1 from public.task_assignments ta_o
      join public.task_assignments ta_me
        on ta_me.task_id = ta_o.task_id and ta_me.employee_id = public.auth_employee_id()
      where ta_o.employee_id = public.employees.id
    )
    or exists (
      select 1 from public.video_assignments va_o
      join public.video_assignments va_me
        on va_me.video_id = va_o.video_id and va_me.employee_id = public.auth_employee_id()
      where va_o.employee_id = public.employees.id
    )
    or exists (
      select 1 from public.tasks t
      where t.assignee_id = public.employees.id
        and (
          t.assignee_id = public.auth_employee_id()
          or public.auth_employee_id() = any (t.watcher_ids)
          or exists (
            select 1 from public.task_assignments ta
            where ta.task_id = t.id and ta.employee_id = public.auth_employee_id()
          )
        )
    )
    or exists (
      select 1 from public.videos v
      where (v.editor_id = public.employees.id or v.cameraman_id = public.employees.id)
        and (
          v.editor_id = public.auth_employee_id()
          or v.cameraman_id = public.auth_employee_id()
          or exists (
            select 1 from public.video_assignments va
            where va.video_id = v.id and va.employee_id = public.auth_employee_id()
          )
        )
    )
  );

drop policy if exists "tasks_insert_operational" on public.tasks;
create policy "tasks_insert_operational"
  on public.tasks for insert
  to authenticated
  with check (
    public.auth_is_admin_or_pm()
    or (
      public.auth_is_department_supervisor()
      and public.tasks.department is not null
      and public.tasks.department = public.auth_employee_department()
    )
    or (
      public.auth_employee_id() is not null
      and public.auth_user_role() in (
        'editor'::public.user_role,
        'cameraman'::public.user_role,
        'developer'::public.user_role,
        'designer'::public.user_role,
        'seo'::public.user_role,
        'community_manager'::public.user_role
      )
    )
  );

drop policy if exists "tasks_update_assigned_or_admin" on public.tasks;
create policy "tasks_update_assigned_or_admin"
  on public.tasks for update
  to authenticated
  using (
    public.auth_is_admin_or_pm()
    or public.auth_can_supervise_department(public.tasks.department)
    or assignee_id = public.auth_employee_id()
    or public.auth_employee_id() = any (watcher_ids)
    or exists (
      select 1
      from public.task_assignments ta
      where ta.task_id = public.tasks.id
        and ta.employee_id = public.auth_employee_id()
    )
  )
  with check (
    public.auth_is_admin_or_pm()
    or public.auth_can_supervise_department(public.tasks.department)
    or assignee_id = public.auth_employee_id()
    or public.auth_employee_id() = any (watcher_ids)
    or exists (
      select 1
      from public.task_assignments ta
      where ta.task_id = public.tasks.id
        and ta.employee_id = public.auth_employee_id()
    )
  );

drop policy if exists "task_assignments_insert_operational" on public.task_assignments;
create policy "task_assignments_insert_operational"
  on public.task_assignments for insert
  to authenticated
  with check (
    public.auth_is_admin_or_pm()
    or exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and public.auth_can_supervise_department(t.department)
    )
    or (
      public.auth_employee_id() is not null
      and public.auth_user_role() is not null
      and public.auth_user_role() not in (
        'finance'::public.user_role,
        'commercial'::public.user_role
      )
      and exists (
        select 1 from public.tasks t
        where t.id = task_assignments.task_id
      )
    )
  );

drop policy if exists "task_assignments_update_assigned_or_admin" on public.task_assignments;
create policy "task_assignments_update_assigned_or_admin"
  on public.task_assignments for update
  to authenticated
  using (
    public.auth_is_admin_or_pm()
    or exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and public.auth_can_supervise_department(t.department)
    )
    or exists (
      select 1 from public.task_assignments ta_peer
      where ta_peer.task_id = task_assignments.task_id
        and ta_peer.employee_id = public.auth_employee_id()
    )
    or exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and t.assignee_id = public.auth_employee_id()
    )
  )
  with check (
    public.auth_is_admin_or_pm()
    or exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and public.auth_can_supervise_department(t.department)
    )
    or exists (
      select 1 from public.task_assignments ta_peer
      where ta_peer.task_id = task_assignments.task_id
        and ta_peer.employee_id = public.auth_employee_id()
    )
    or exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and t.assignee_id = public.auth_employee_id()
    )
  );

drop policy if exists "task_assignments_delete_assigned_or_admin" on public.task_assignments;
create policy "task_assignments_delete_assigned_or_admin"
  on public.task_assignments for delete
  to authenticated
  using (
    public.auth_is_admin_or_pm()
    or exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and public.auth_can_supervise_department(t.department)
    )
    or exists (
      select 1 from public.task_assignments ta_peer
      where ta_peer.task_id = task_assignments.task_id
        and ta_peer.employee_id = public.auth_employee_id()
    )
    or exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and t.assignee_id = public.auth_employee_id()
    )
  );
