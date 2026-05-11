-- ============================================================================
-- Durcissement RLS — SELECT scopés par rôle / périmètre (défense en profondeur)
-- ============================================================================
-- Idempotent : chaque CREATE POLICY est précédé de DROP POLICY IF EXISTS sur le
-- même nom (ré-exécution, staging déjà partiellement migré, ou alignement avec
-- policies.sql sans erreur 42710).
-- ============================================================================
-- Les helpers en SECURITY DEFINER + row_security=off évitent la récursion RLS
-- lors des sous-requêtes sur tasks/videos/clients.
-- Les colonnes legacy tasks.assignee_id, videos.editor_id / cameraman_id restent
-- prises en charge en parallèle de task_assignments / video_assignments.
-- ============================================================================

-- ─── Helpers RBAC légers ───────────────────────────────────────────────────

create or replace function public.auth_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_user_role() = 'admin'::public.user_role;
$$;

create or replace function public.auth_is_finance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_user_role() = 'finance'::public.user_role;
$$;

create or replace function public.auth_is_commercial()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_user_role() = 'commercial'::public.user_role;
$$;

create or replace function public.auth_can_view_global_finance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_user_role() in ('admin'::public.user_role, 'finance'::public.user_role);
$$;

-- ─── Périmètre clients (staff) ─────────────────────────────────────────────

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

-- ─── Projets & internes ─────────────────────────────────────────────────────

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
  cid uuid;
begin
  select e.role, e.id into r, ae
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

  if r in ('admin'::public.user_role, 'project_manager'::public.user_role) then
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

create or replace function public.auth_staff_internal_project_visible(p_ip_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  ae uuid;
begin
  if auth_is_admin_or_pm() then
    return true;
  end if;

  select e.id into ae
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;

  if ae is null then
    return false;
  end if;

  return exists (
    select 1 from public.internal_projects ip
    where ip.id = p_ip_id
      and (ip.owner_id = ae or ae = any (ip.team_ids))
  );
end;
$$;

-- ─── Vidéos ────────────────────────────────────────────────────────────────

create or replace function public.auth_staff_video_visible(p_video_id uuid)
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
  v record;
begin
  select e.role, e.id into r, ae
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;

  if r is null or ae is null then
    return false;
  end if;

  select * into v from public.videos where id = p_video_id;
  if not found then
    return false;
  end if;

  if r in ('admin'::public.user_role, 'project_manager'::public.user_role) then
    return true;
  end if;

  if r in ('finance'::public.user_role) then
    return false;
  end if;

  if r = 'commercial'::public.user_role then
    return exists (
      select 1 from public.clients c
      where c.id = v.client_id and c.account_manager_id = ae
    );
  end if;

  if r = 'editor'::public.user_role then
    return v.editor_id = ae or v.cameraman_id = ae
      or exists (
        select 1 from public.video_assignments va
        where va.video_id = v.id and va.employee_id = ae
      );
  end if;

  if r = 'cameraman'::public.user_role then
    return v.cameraman_id = ae
      or exists (
        select 1 from public.video_assignments va
        where va.video_id = v.id and va.employee_id = ae and va.assignment_role = 'cameraman'::public.video_assignment_role
      );
  end if;

  if r = 'community_manager'::public.user_role then
    return v.editor_id = ae or v.cameraman_id = ae
      or exists (
        select 1 from public.video_assignments va
        where va.video_id = v.id and va.employee_id = ae
      );
  end if;

  return false;
end;
$$;

-- ─── Tâches ────────────────────────────────────────────────────────────────

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

-- ─── Documents (ligne complète lue avec row_security off) ───────────────────

create or replace function public.auth_staff_document_visible_by_id(p_doc_id uuid)
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
  d record;
begin
  select e.role, e.id into r, ae
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;

  if r is null or ae is null then
    return false;
  end if;

  select * into d from public.documents where id = p_doc_id;
  if not found then
    return false;
  end if;

  if r in ('admin'::public.user_role, 'project_manager'::public.user_role) then
    return true;
  end if;

  if r = 'finance'::public.user_role then
    return false;
  end if;

  if r = 'commercial'::public.user_role then
    if d.client_id is not null then
      return exists (
        select 1 from public.clients c
        where c.id = d.client_id and c.account_manager_id = ae
      );
    end if;
    if d.project_id is not null then
      return exists (
        select 1 from public.projects p
        join public.clients c on c.id = p.client_id
        where p.id = d.project_id and c.account_manager_id = ae
      );
    end if;
    if d.video_id is not null then
      return exists (
        select 1 from public.videos v
        join public.clients c on c.id = v.client_id
        where v.id = d.video_id and c.account_manager_id = ae
      );
    end if;
    return false;
  end if;

  if d.video_id is not null
     and r in ('editor'::public.user_role, 'cameraman'::public.user_role, 'community_manager'::public.user_role) then
    return public.auth_staff_video_visible(d.video_id);
  end if;

  if d.project_id is not null and r in ('developer'::public.user_role, 'designer'::public.user_role, 'seo'::public.user_role) then
    return public.auth_staff_project_visible(d.project_id);
  end if;

  if d.client_id is not null
     and r in ('editor'::public.user_role, 'cameraman'::public.user_role, 'community_manager'::public.user_role) then
    return public.auth_staff_client_visible(d.client_id);
  end if;

  return false;
end;
$$;

-- ─── Rapports ─────────────────────────────────────────────────────────────

create or replace function public.auth_staff_report_visible(p_report_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  r public.user_role;
  rep record;
begin
  select e.role into r
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;

  if r is null then
    return false;
  end if;

  select * into rep from public.reports where id = p_report_id;
  if not found then
    return false;
  end if;

  if r in ('admin'::public.user_role, 'project_manager'::public.user_role, 'finance'::public.user_role) then
    return true;
  end if;

  if not public.auth_staff_client_visible(rep.client_id) then
    return false;
  end if;

  if r = 'commercial'::public.user_role then
    return true;
  end if;

  if r = 'seo'::public.user_role or r = 'designer'::public.user_role then
    return rep.type = 'seo'::public.report_type;
  end if;

  if r = 'community_manager'::public.user_role then
    return rep.type in (
      'social_media'::public.report_type,
      'video_production'::public.report_type,
      'monthly'::public.report_type,
      'weekly'::public.report_type
    );
  end if;

  return false;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- POLICIES SELECT — remplacements
-- ═══════════════════════════════════════════════════════════════════════════

-- EMPLOYEES
drop policy if exists "employees_select_authenticated" on public.employees;
drop policy if exists "employees_select_scoped" on public.employees;
create policy "employees_select_scoped"
  on public.employees for select
  to authenticated
  using (
    public.auth_is_admin()
    or public.auth_user_role() = 'project_manager'::public.user_role
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

-- CLIENTS
drop policy if exists "clients_select_internal" on public.clients;
drop policy if exists "clients_select_scoped" on public.clients;
create policy "clients_select_scoped"
  on public.clients for select
  to authenticated
  using (public.auth_staff_client_visible(public.clients.id));

-- PROJECTS
drop policy if exists "projects_select_internal" on public.projects;
drop policy if exists "projects_select_scoped" on public.projects;
create policy "projects_select_scoped"
  on public.projects for select
  to authenticated
  using (public.auth_staff_project_visible(public.projects.id));

-- INTERNAL PROJECTS
drop policy if exists "internal_projects_select" on public.internal_projects;
drop policy if exists "internal_projects_select_scoped" on public.internal_projects;
create policy "internal_projects_select_scoped"
  on public.internal_projects for select
  to authenticated
  using (public.auth_staff_internal_project_visible(public.internal_projects.id));

-- TASKS
drop policy if exists "tasks_select_internal" on public.tasks;
drop policy if exists "tasks_select_scoped" on public.tasks;
create policy "tasks_select_scoped"
  on public.tasks for select
  to authenticated
  using (public.auth_staff_task_visible(public.tasks.id));

-- TASK ASSIGNMENTS
drop policy if exists "task_assignments_select_internal" on public.task_assignments;
drop policy if exists "task_assignments_select_scoped" on public.task_assignments;
create policy "task_assignments_select_scoped"
  on public.task_assignments for select
  to authenticated
  using (
    public.auth_is_admin_or_pm()
    or public.auth_staff_task_visible(public.task_assignments.task_id)
  );

-- VIDEOS
drop policy if exists "videos_select_internal" on public.videos;
drop policy if exists "videos_select_scoped" on public.videos;
create policy "videos_select_scoped"
  on public.videos for select
  to authenticated
  using (public.auth_staff_video_visible(public.videos.id));

-- VIDEO ASSIGNMENTS
drop policy if exists "video_assignments_select_internal" on public.video_assignments;
drop policy if exists "video_assignments_select_scoped" on public.video_assignments;
create policy "video_assignments_select_scoped"
  on public.video_assignments for select
  to authenticated
  using (
    public.auth_is_admin_or_pm()
    or public.auth_staff_video_visible(public.video_assignments.video_id)
  );

-- EDITORIAL CALENDARS
drop policy if exists "calendars_select_internal" on public.editorial_calendars;
drop policy if exists "calendars_select_scoped" on public.editorial_calendars;
create policy "calendars_select_scoped"
  on public.editorial_calendars for select
  to authenticated
  using (
    public.auth_is_admin_or_pm()
    or public.auth_staff_client_visible(public.editorial_calendars.client_id)
  );

-- INVOICES
drop policy if exists "invoices_select_financial" on public.invoices;
drop policy if exists "invoices_select_scoped" on public.invoices;
create policy "invoices_select_scoped"
  on public.invoices for select
  to authenticated
  using (
    public.auth_is_admin_or_pm()
    or public.auth_is_finance()
    or (
      public.auth_is_commercial()
      and exists (
        select 1 from public.clients c
        where c.id = public.invoices.client_id and c.account_manager_id = public.auth_employee_id()
      )
    )
  );

-- INVOICE ITEMS
drop policy if exists "invoice_items_select" on public.invoice_items;
drop policy if exists "invoice_items_select_scoped" on public.invoice_items;
create policy "invoice_items_select_scoped"
  on public.invoice_items for select
  to authenticated
  using (
    exists (
      select 1 from public.invoices inv
      where inv.id = public.invoice_items.invoice_id
        and (
          public.auth_is_admin_or_pm()
          or public.auth_is_finance()
          or (
            public.auth_is_commercial()
            and exists (
              select 1 from public.clients c
              where c.id = inv.client_id and c.account_manager_id = public.auth_employee_id()
            )
          )
        )
    )
  );

-- QUOTES (chef de projet : lecture pour pilotage portail / prod, pas l’onglet devis finance)
drop policy if exists "quotes_select_financial" on public.quotes;
drop policy if exists "quotes_select_scoped" on public.quotes;
create policy "quotes_select_scoped"
  on public.quotes for select
  to authenticated
  using (
    public.auth_is_admin()
    or public.auth_user_role() = 'project_manager'::public.user_role
    or public.auth_is_finance()
    or (
      public.auth_is_commercial()
      and exists (
        select 1 from public.clients c
        where c.id = public.quotes.client_id and c.account_manager_id = public.auth_employee_id()
      )
    )
  );

-- QUOTE ITEMS
drop policy if exists "quote_items_select" on public.quote_items;
drop policy if exists "quote_items_select_scoped" on public.quote_items;
create policy "quote_items_select_scoped"
  on public.quote_items for select
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = public.quote_items.quote_id
        and (
          public.auth_is_admin()
          or public.auth_user_role() = 'project_manager'::public.user_role
          or public.auth_is_finance()
          or (
            public.auth_is_commercial()
            and exists (
              select 1 from public.clients c
              where c.id = q.client_id and c.account_manager_id = public.auth_employee_id()
            )
          )
        )
    )
  );

-- PAYMENTS (sans chef de projet)
drop policy if exists "payments_select_financial" on public.payments;
drop policy if exists "payments_select_scoped" on public.payments;
create policy "payments_select_scoped"
  on public.payments for select
  to authenticated
  using (
    public.auth_is_admin()
    or public.auth_is_finance()
    or (
      public.auth_is_commercial()
      and exists (
        select 1 from public.clients c
        where c.id = public.payments.client_id and c.account_manager_id = public.auth_employee_id()
      )
    )
  );

-- REPORTS
drop policy if exists "reports_select_internal" on public.reports;
drop policy if exists "reports_select_scoped" on public.reports;
create policy "reports_select_scoped"
  on public.reports for select
  to authenticated
  using (public.auth_staff_report_visible(public.reports.id));

-- DOCUMENTS
drop policy if exists "documents_select_internal" on public.documents;
drop policy if exists "documents_select_scoped" on public.documents;
create policy "documents_select_scoped"
  on public.documents for select
  to authenticated
  using (public.auth_staff_document_visible_by_id(public.documents.id));

-- NOTIFICATIONS (plus de lecture globale admin)
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (public.notifications.recipient_user_id = auth.uid());

-- COMMENTS
drop policy if exists "comments_select_internal" on public.comments;
drop policy if exists "comments_select_scoped" on public.comments;
create policy "comments_select_scoped"
  on public.comments for select
  to authenticated
  using (
    public.auth_is_admin_or_pm()
    or public.comments.author_id = auth.uid()
    or (
      public.comments.entity_type = 'task'
      and public.auth_staff_task_visible(public.comments.entity_id::uuid)
    )
    or (
      public.comments.entity_type = 'video'
      and public.auth_staff_video_visible(public.comments.entity_id::uuid)
    )
    or (
      public.comments.entity_type = 'project'
      and public.auth_staff_project_visible(public.comments.entity_id::uuid)
    )
  );

-- ACTIVITY LOGS — opération / audit interne limité admin & PM
drop policy if exists "logs_select_admin_pm" on public.activity_logs;
drop policy if exists "logs_select_admin_only" on public.activity_logs;
drop policy if exists "logs_select_internal" on public.activity_logs;
create policy "logs_select_admin_pm"
  on public.activity_logs for select
  to authenticated
  using (public.auth_is_admin_or_pm());

-- AGENCY SETTINGS — inchangé périmètre lecture (pas de secrets sensibles dans la ligne)
-- (laisser policy existante agency_settings_select_internal si présente)

-- AGENCY MONTHLY GOALS — pilotage chiffré (admin / finance / commercial uniquement)
drop policy if exists "agency_monthly_goals_select_staff" on public.agency_monthly_goals;
drop policy if exists "agency_monthly_goals_select_scoped" on public.agency_monthly_goals;
create policy "agency_monthly_goals_select_scoped"
  on public.agency_monthly_goals for select
  to authenticated
  using (
    public.auth_user_role() in (
      'admin'::public.user_role,
      'finance'::public.user_role,
      'commercial'::public.user_role
    )
  );
