-- Phase 2 RLS : réaligne auth_staff_client_visible (finance = clients avec trace
-- facture/devis/paiement), notifications (destinataire OU admin), activity_logs
-- (admin OU chef de projet). Les objectifs mensuels restent dans 20260528120000.

-- ─── Clients : finance limitée aux comptes ayant déjà une trace financière ───

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

  if r in ('admin'::public.user_role, 'project_manager'::public.user_role) then
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

-- ─── Notifications : destinataire ou admin (support) ───────────────────────

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (
    public.notifications.recipient_user_id = auth.uid()
    or public.auth_is_admin()
  );

-- ─── Activity logs : admin + chef de projet (pas production / finance / etc.)

drop policy if exists "logs_select_admin_pm" on public.activity_logs;
drop policy if exists "logs_select_admin_only" on public.activity_logs;
drop policy if exists "logs_select_internal" on public.activity_logs;
create policy "logs_select_admin_pm"
  on public.activity_logs for select
  to authenticated
  using (public.auth_is_admin_or_pm());
