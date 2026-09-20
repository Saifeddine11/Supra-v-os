-- Supervisors need operational selectors to see active clients/projects when creating work.
-- This does not change client portal RPCs or finance/commercial-specific permissions.

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

create or replace function public.auth_staff_project_visible(p_project_id uuid)
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
  cid uuid;
begin
  select e.role, e.id, e.is_department_supervisor
    into r, ae, is_sup
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;

  if r is null or ae is null then
    return false;
  end if;

  select p.client_id into cid
  from public.projects p
  where p.id = p_project_id;

  if cid is null then
    return false;
  end if;

  if r in (
    'admin'::public.user_role,
    'project_manager'::public.user_role
  ) or coalesce(is_sup, false)
    or r = 'department_supervisor'::public.user_role then
    return true;
  end if;

  if r = 'commercial'::public.user_role then
    return exists (
      select 1 from public.clients c
      where c.id = cid and c.account_manager_id = ae
    );
  end if;

  if r in ('developer'::public.user_role, 'designer'::public.user_role, 'seo'::public.user_role) then
    if not exists (
      select 1 from public.projects p
      where p.id = p_project_id
        and (p.lead_id = ae or ae = any (p.team_ids))
    ) then
      return false;
    end if;
    if r = 'seo'::public.user_role then
      return exists (
        select 1 from public.projects p
        where p.id = p_project_id and p.type ilike '%seo%'
      );
    end if;
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.auth_staff_client_visible(uuid) from public;
revoke all on function public.auth_staff_project_visible(uuid) from public;
grant execute on function public.auth_staff_client_visible(uuid) to authenticated;
grant execute on function public.auth_staff_project_visible(uuid) to authenticated;
