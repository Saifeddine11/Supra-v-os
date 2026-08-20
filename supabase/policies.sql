-- ============================================================================
-- SUPRA V. AGENCY OS — ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- Apply AFTER schema.sql has been run.
--
-- Strategy:
--   - All tables have RLS enabled.
--   - admin / project_manager: full modify on many entities; SELECT is scoped
--     per table via helpers (auth_staff_*) sauf périmètre global explicite.
--   - Les lectures cross-rôles passent par des fonctions SECURITY DEFINER +
--     row_security off (voir schema.sql + migration harden_rls_select_scope).
--   - Clients DO NOT use Supabase Auth → portal access goes through server-
--     side validated tokens via the service role. We therefore do NOT add
--     "client" policies here; instead we revoke direct access for the anon
--     role on sensitive tables (the service role bypasses RLS).
--
-- ============================================================================

-- ─── ENABLE RLS ─────────────────────────────────────────────────────────────
alter table employees            enable row level security;
alter table clients              enable row level security;
alter table client_portals       enable row level security;
alter table projects             enable row level security;
alter table internal_projects    enable row level security;
alter table tasks                enable row level security;
alter table task_assignments     enable row level security;
alter table videos               enable row level security;
alter table video_assignments    enable row level security;
alter table editorial_calendars  enable row level security;
alter table video_templates      enable row level security;
alter table content_ideas        enable row level security;
alter table invoices             enable row level security;
alter table invoice_items        enable row level security;
alter table quotes               enable row level security;
alter table quote_items          enable row level security;
alter table payments             enable row level security;
alter table reports              enable row level security;
alter table documents            enable row level security;
alter table notifications        enable row level security;
alter table comments             enable row level security;
alter table activity_logs        enable row level security;
alter table agency_settings      enable row level security;
alter table agency_monthly_goals  enable row level security;
alter table user_notification_preferences enable row level security;
alter table task_discord_messages enable row level security;
alter table discord_channel_routes enable row level security;
alter table discord_reminder_deliveries enable row level security;

-- ============================================================================
-- EMPLOYEES
-- ============================================================================
-- Admin & PM : roster complet. Finance : sa ligne uniquement. Autres :
-- soi + collègues sur mêmes tâches / vidéos (assignations + legacy).

drop policy if exists "employees_select_authenticated" on employees;
drop policy if exists "employees_select_scoped" on employees;
create policy "employees_select_scoped"
  on employees for select
  to authenticated
  using (
    public.auth_is_admin()
    or public.auth_user_role() = 'project_manager'::public.user_role
    or employees.user_id = auth.uid()
    or employees.id = public.auth_employee_id()
    or (
      public.auth_user_role() = 'finance'::public.user_role
      and employees.id = public.auth_employee_id()
    )
    or exists (
      select 1 from public.task_assignments ta_o
      join public.task_assignments ta_me
        on ta_me.task_id = ta_o.task_id and ta_me.employee_id = public.auth_employee_id()
      where ta_o.employee_id = employees.id
    )
    or exists (
      select 1 from public.video_assignments va_o
      join public.video_assignments va_me
        on va_me.video_id = va_o.video_id and va_me.employee_id = public.auth_employee_id()
      where va_o.employee_id = employees.id
    )
    or exists (
      select 1 from public.tasks t
      where t.assignee_id = employees.id
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
      where (v.editor_id = employees.id or v.cameraman_id = employees.id)
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

drop policy if exists "employees_insert_admin" on employees;
create policy "employees_insert_admin"
  on employees for insert
  to authenticated
  with check (auth_user_role() = 'admin');

drop policy if exists "employees_update_admin_or_self" on employees;
create policy "employees_update_admin_or_self"
  on employees for update
  to authenticated
  using (
    auth_user_role() = 'admin'
    or user_id = auth.uid()
  );

drop policy if exists "employees_delete_admin" on employees;
create policy "employees_delete_admin"
  on employees for delete
  to authenticated
  using (auth_user_role() = 'admin');

-- ============================================================================
-- CLIENTS
-- ============================================================================
-- SELECT : périmètre auth_staff_client_visible. Modifications: admin / PM / commercial.

drop policy if exists "clients_select_internal" on clients;
drop policy if exists "clients_select_scoped" on clients;
create policy "clients_select_scoped"
  on clients for select
  to authenticated
  using (public.auth_staff_client_visible(clients.id));

drop policy if exists "clients_insert_authorized" on clients;
create policy "clients_insert_authorized"
  on clients for insert
  to authenticated
  with check (auth_user_role() in ('admin', 'project_manager', 'commercial'));

drop policy if exists "clients_update_authorized" on clients;
create policy "clients_update_authorized"
  on clients for update
  to authenticated
  using (auth_user_role() in ('admin', 'project_manager', 'commercial'));

drop policy if exists "clients_delete_admin" on clients;
create policy "clients_delete_admin"
  on clients for delete
  to authenticated
  using (auth_user_role() = 'admin');

-- ============================================================================
-- CLIENT PORTALS
-- ============================================================================
-- Only admin/PM can manage portal tokens. (Validation happens server-side
-- via service role.)

drop policy if exists "portals_admin_pm_all" on client_portals;
create policy "portals_admin_pm_all"
  on client_portals for all
  to authenticated
  using (auth_is_admin_or_pm())
  with check (auth_is_admin_or_pm());

-- ============================================================================
-- PROJECTS
-- ============================================================================

drop policy if exists "projects_select_internal" on projects;
drop policy if exists "projects_select_scoped" on projects;
create policy "projects_select_scoped"
  on projects for select
  to authenticated
  using (public.auth_staff_project_visible(projects.id));

drop policy if exists "projects_insert_authorized" on projects;
create policy "projects_insert_authorized"
  on projects for insert
  to authenticated
  with check (auth_user_role() in ('admin', 'project_manager', 'commercial'));

drop policy if exists "projects_update_authorized" on projects;
create policy "projects_update_authorized"
  on projects for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or lead_id = auth_employee_id()
    or auth_employee_id() = any(team_ids)
  );

drop policy if exists "projects_delete_admin_pm" on projects;
create policy "projects_delete_admin_pm"
  on projects for delete
  to authenticated
  using (auth_is_admin_or_pm());

-- ============================================================================
-- INTERNAL PROJECTS
-- ============================================================================

drop policy if exists "internal_projects_select" on internal_projects;
drop policy if exists "internal_projects_select_scoped" on internal_projects;
create policy "internal_projects_select_scoped"
  on internal_projects for select
  to authenticated
  using (public.auth_staff_internal_project_visible(internal_projects.id));

drop policy if exists "internal_projects_modify_admin_pm" on internal_projects;
create policy "internal_projects_modify_admin_pm"
  on internal_projects for all
  to authenticated
  using (auth_is_admin_or_pm())
  with check (auth_is_admin_or_pm());

-- ============================================================================
-- TASKS
-- ============================================================================
-- SELECT : auth_staff_task_visible (assignations + legacy + liens vidéo/projet).
-- Modifications: admin/PM, OR the assignee for their own tasks.

drop policy if exists "tasks_select_internal" on tasks;
drop policy if exists "tasks_select_scoped" on tasks;
create policy "tasks_select_scoped"
  on tasks for select
  to authenticated
  using (public.auth_staff_task_visible(tasks.id));

drop policy if exists "tasks_insert_authorized" on tasks;
drop policy if exists "tasks_insert_operational" on tasks;
create policy "tasks_insert_operational"
  on tasks for insert
  to authenticated
  with check (
    auth_is_admin_or_pm()
    or (
      auth_employee_id() is not null
      and auth_user_role() in (
        'editor', 'cameraman', 'developer', 'designer', 'seo', 'community_manager'
      )
    )
  );

drop policy if exists "tasks_update_assigned_or_admin" on tasks;
-- Pivot task_assignments + legacy assignee_id / watchers.
create policy "tasks_update_assigned_or_admin"
  on tasks for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or assignee_id = auth_employee_id()
    or auth_employee_id() = any(watcher_ids)
    or exists (
      select 1
      from task_assignments ta
      where ta.task_id = tasks.id
        and ta.employee_id = auth_employee_id()
    )
  )
  with check (
    auth_is_admin_or_pm()
    or assignee_id = auth_employee_id()
    or auth_employee_id() = any(watcher_ids)
    or exists (
      select 1
      from task_assignments ta
      where ta.task_id = tasks.id
        and ta.employee_id = auth_employee_id()
    )
  );

-- ============================================================================
-- TASK ASSIGNMENTS (multi-assignés)
-- ============================================================================

drop policy if exists "task_assignments_select_internal" on task_assignments;
drop policy if exists "task_assignments_select_scoped" on task_assignments;
create policy "task_assignments_select_scoped"
  on task_assignments for select
  to authenticated
  using (
    auth_is_admin_or_pm()
    or public.auth_staff_task_visible(task_assignments.task_id)
  );

drop policy if exists "task_assignments_insert_authorized" on task_assignments;
drop policy if exists "task_assignments_insert_operational" on task_assignments;
create policy "task_assignments_insert_operational"
  on task_assignments for insert
  to authenticated
  with check (
    auth_is_admin_or_pm()
    or (
      auth_employee_id() is not null
      and auth_user_role() is not null
      and auth_user_role() not in ('finance', 'commercial')
      and exists (select 1 from tasks t where t.id = task_assignments.task_id)
    )
  );

drop policy if exists "task_assignments_update_assigned_or_admin" on task_assignments;
create policy "task_assignments_update_assigned_or_admin"
  on task_assignments for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from task_assignments ta_peer
      where ta_peer.task_id = task_assignments.task_id
        and ta_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from tasks t
      where t.id = task_assignments.task_id
        and t.assignee_id = auth_employee_id()
    )
  )
  with check (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from task_assignments ta_peer
      where ta_peer.task_id = task_assignments.task_id
        and ta_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from tasks t
      where t.id = task_assignments.task_id
        and t.assignee_id = auth_employee_id()
    )
  );

drop policy if exists "task_assignments_delete_assigned_or_admin" on task_assignments;
create policy "task_assignments_delete_assigned_or_admin"
  on task_assignments for delete
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from task_assignments ta_peer
      where ta_peer.task_id = task_assignments.task_id
        and ta_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from tasks t
      where t.id = task_assignments.task_id
        and t.assignee_id = auth_employee_id()
    )
  );

drop policy if exists "tasks_delete_admin_pm" on tasks;
create policy "tasks_delete_admin_pm"
  on tasks for delete
  to authenticated
  using (auth_is_admin_or_pm());

-- ============================================================================
-- VIDEOS
-- ============================================================================

drop policy if exists "videos_select_internal" on videos;
drop policy if exists "videos_select_scoped" on videos;
create policy "videos_select_scoped"
  on videos for select
  to authenticated
  using (public.auth_staff_video_visible(videos.id));

drop policy if exists "videos_insert_authorized" on videos;
create policy "videos_insert_authorized"
  on videos for insert
  to authenticated
  with check (auth_user_role() in ('admin', 'project_manager', 'editor', 'cameraman', 'commercial', 'community_manager'));

drop policy if exists "videos_update_assigned_or_admin" on videos;
-- Pivot video_assignments = source principale ; legacy editor_id / cameraman_id = secours.
create policy "videos_update_assigned_or_admin"
  on videos for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from video_assignments va
      where va.video_id = videos.id
        and va.employee_id = auth_employee_id()
    )
    or editor_id = auth_employee_id()
    or cameraman_id = auth_employee_id()
  )
  with check (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from video_assignments va
      where va.video_id = videos.id
        and va.employee_id = auth_employee_id()
    )
    or editor_id = auth_employee_id()
    or cameraman_id = auth_employee_id()
  );

drop policy if exists "videos_delete_admin_pm" on videos;
create policy "videos_delete_admin_pm"
  on videos for delete
  to authenticated
  using (auth_is_admin_or_pm());

-- ============================================================================
-- VIDEO ASSIGNMENTS (multi monteurs / cadreurs)
-- ============================================================================

drop policy if exists "video_assignments_select_internal" on video_assignments;
drop policy if exists "video_assignments_select_scoped" on video_assignments;
create policy "video_assignments_select_scoped"
  on video_assignments for select
  to authenticated
  using (
    auth_is_admin_or_pm()
    or public.auth_staff_video_visible(video_assignments.video_id)
  );

drop policy if exists "video_assignments_insert_authorized" on video_assignments;
create policy "video_assignments_insert_authorized"
  on video_assignments for insert
  to authenticated
  with check (
    auth_user_role() in ('admin', 'project_manager', 'editor', 'cameraman', 'commercial', 'community_manager')
    and exists (select 1 from videos v where v.id = video_assignments.video_id)
  );

drop policy if exists "video_assignments_update_assigned_or_admin" on video_assignments;
-- Même employé sur une autre ligne d’assignation = accès ; legacy en secours.
create policy "video_assignments_update_assigned_or_admin"
  on video_assignments for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from video_assignments va_peer
      where va_peer.video_id = video_assignments.video_id
        and va_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from videos v
      where v.id = video_assignments.video_id
        and (v.editor_id = auth_employee_id() or v.cameraman_id = auth_employee_id())
    )
  )
  with check (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from video_assignments va_peer
      where va_peer.video_id = video_assignments.video_id
        and va_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from videos v
      where v.id = video_assignments.video_id
        and (v.editor_id = auth_employee_id() or v.cameraman_id = auth_employee_id())
    )
  );

drop policy if exists "video_assignments_delete_assigned_or_admin" on video_assignments;
create policy "video_assignments_delete_assigned_or_admin"
  on video_assignments for delete
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from video_assignments va_peer
      where va_peer.video_id = video_assignments.video_id
        and va_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from videos v
      where v.id = video_assignments.video_id
        and (v.editor_id = auth_employee_id() or v.cameraman_id = auth_employee_id())
    )
  );

-- ============================================================================
-- EDITORIAL CALENDARS
-- ============================================================================

drop policy if exists "calendars_select_internal" on editorial_calendars;
drop policy if exists "calendars_select_scoped" on editorial_calendars;
create policy "calendars_select_scoped"
  on editorial_calendars for select
  to authenticated
  using (
    auth_is_admin_or_pm()
    or public.auth_staff_client_visible(editorial_calendars.client_id)
  );

drop policy if exists "calendars_modify_admin_pm" on editorial_calendars;
create policy "calendars_modify_admin_pm"
  on editorial_calendars for all
  to authenticated
  using (auth_is_admin_or_pm())
  with check (auth_is_admin_or_pm());

-- ============================================================================
-- VIDEO TEMPLATES & CONTENT IDEAS (read-all internal, write admin/PM)
-- ============================================================================

drop policy if exists "templates_select_internal" on video_templates;
create policy "templates_select_internal"
  on video_templates for select
  to authenticated
  using (auth_user_role() is not null);

drop policy if exists "templates_modify_admin_pm" on video_templates;
create policy "templates_modify_admin_pm"
  on video_templates for all
  to authenticated
  using (auth_is_admin_or_pm())
  with check (auth_is_admin_or_pm());

drop policy if exists "ideas_select_internal" on content_ideas;
create policy "ideas_select_internal"
  on content_ideas for select
  to authenticated
  using (auth_user_role() is not null);

drop policy if exists "ideas_modify_internal" on content_ideas;
create policy "ideas_modify_internal"
  on content_ideas for all
  to authenticated
  using (auth_user_role() is not null)
  with check (auth_user_role() is not null);

-- ============================================================================
-- INVOICES & ITEMS — restricted to financial roles
-- ============================================================================

drop policy if exists "invoices_select_financial" on invoices;
drop policy if exists "invoices_select_scoped" on invoices;
create policy "invoices_select_scoped"
  on invoices for select
  to authenticated
  using (
    public.auth_is_admin()
    or public.auth_is_finance()
    or (
      public.auth_is_commercial()
      and exists (
        select 1 from clients c
        where c.id = invoices.client_id and c.account_manager_id = auth_employee_id()
      )
    )
  );

drop policy if exists "invoices_modify_financial" on invoices;
create policy "invoices_modify_financial"
  on invoices for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));

drop policy if exists "invoice_items_select" on invoice_items;
drop policy if exists "invoice_items_select_scoped" on invoice_items;
create policy "invoice_items_select_scoped"
  on invoice_items for select
  to authenticated
  using (
    exists (
      select 1 from invoices inv
      where inv.id = invoice_items.invoice_id
        and (
          public.auth_is_admin()
          or public.auth_is_finance()
          or (
            public.auth_is_commercial()
            and exists (
              select 1 from clients c
              where c.id = inv.client_id and c.account_manager_id = auth_employee_id()
            )
          )
        )
    )
  );

drop policy if exists "invoice_items_modify" on invoice_items;
create policy "invoice_items_modify"
  on invoice_items for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));

-- ============================================================================
-- QUOTES & ITEMS
-- ============================================================================

drop policy if exists "quotes_select_financial" on quotes;
drop policy if exists "quotes_select_scoped" on quotes;
create policy "quotes_select_scoped"
  on quotes for select
  to authenticated
  using (
    public.auth_is_admin()
    or public.auth_is_finance()
    or (
      public.auth_is_commercial()
      and exists (
        select 1 from clients c
        where c.id = quotes.client_id and c.account_manager_id = auth_employee_id()
      )
    )
  );

drop policy if exists "quotes_modify_financial" on quotes;
create policy "quotes_modify_financial"
  on quotes for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));

drop policy if exists "quote_items_select" on quote_items;
drop policy if exists "quote_items_select_scoped" on quote_items;
create policy "quote_items_select_scoped"
  on quote_items for select
  to authenticated
  using (
    exists (
      select 1 from quotes q
      where q.id = quote_items.quote_id
        and (
          public.auth_is_admin()
          or public.auth_is_finance()
          or (
            public.auth_is_commercial()
            and exists (
              select 1 from clients c
              where c.id = q.client_id and c.account_manager_id = auth_employee_id()
            )
          )
        )
    )
  );

drop policy if exists "quote_items_modify" on quote_items;
create policy "quote_items_modify"
  on quote_items for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));

-- ============================================================================
-- PAYMENTS
-- ============================================================================

drop policy if exists "payments_select_financial" on payments;
drop policy if exists "payments_select_scoped" on payments;
create policy "payments_select_scoped"
  on payments for select
  to authenticated
  using (
    public.auth_is_admin()
    or public.auth_is_finance()
    or (
      public.auth_is_commercial()
      and exists (
        select 1 from clients c
        where c.id = payments.client_id and c.account_manager_id = auth_employee_id()
      )
    )
  );

drop policy if exists "payments_modify_admin_commercial" on payments;
create policy "payments_modify_admin_commercial"
  on payments for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));

-- ============================================================================
-- REPORTS
-- ============================================================================

drop policy if exists "reports_select_internal" on reports;
drop policy if exists "reports_select_scoped" on reports;
create policy "reports_select_scoped"
  on reports for select
  to authenticated
  using (public.auth_staff_report_visible(reports.id));

drop policy if exists "reports_modify_admin_pm" on reports;
create policy "reports_modify_admin_pm"
  on reports for all
  to authenticated
  using (auth_is_admin_or_pm())
  with check (auth_is_admin_or_pm());

-- ============================================================================
-- DOCUMENTS
-- ============================================================================
-- SELECT : auth_staff_document_visible_by_id. Portail client : service role.

drop policy if exists "documents_select_internal" on documents;
drop policy if exists "documents_select_scoped" on documents;
create policy "documents_select_scoped"
  on documents for select
  to authenticated
  using (public.auth_staff_document_visible_by_id(documents.id));

drop policy if exists "documents_modify_internal" on documents;
create policy "documents_modify_internal"
  on documents for all
  to authenticated
  using (auth_user_role() is not null)
  with check (auth_user_role() is not null);

-- ============================================================================
-- NOTIFICATIONS — soi + admin (support)
-- ============================================================================

drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own"
  on notifications for select
  to authenticated
  using (recipient_user_id = auth.uid() or public.auth_is_admin());

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own"
  on notifications for update
  to authenticated
  using (recipient_user_id = auth.uid());

drop policy if exists "notifications_insert_authenticated" on notifications;
create policy "notifications_insert_authenticated"
  on notifications for insert
  to authenticated
  with check (true);  -- service-side function will enforce; UI rarely creates

drop policy if exists "notifications_delete_own" on notifications;
create policy "notifications_delete_own"
  on notifications for delete
  to authenticated
  using (recipient_user_id = auth.uid() or auth_user_role() = 'admin');

-- ============================================================================
-- COMMENTS
-- ============================================================================

drop policy if exists "comments_select_internal" on comments;
drop policy if exists "comments_select_scoped" on comments;
create policy "comments_select_scoped"
  on comments for select
  to authenticated
  using (
    auth_is_admin_or_pm()
    or comments.author_id = auth.uid()
    or (
      comments.entity_type = 'task'
      and public.auth_staff_task_visible(comments.entity_id::uuid)
    )
    or (
      comments.entity_type = 'video'
      and public.auth_staff_video_visible(comments.entity_id::uuid)
    )
    or (
      comments.entity_type = 'project'
      and public.auth_staff_project_visible(comments.entity_id::uuid)
    )
  );

drop policy if exists "comments_insert_internal" on comments;
create policy "comments_insert_internal"
  on comments for insert
  to authenticated
  with check (auth_user_role() is not null and author_id = auth.uid());

drop policy if exists "comments_update_own" on comments;
create policy "comments_update_own"
  on comments for update
  to authenticated
  using (author_id = auth.uid() or auth_is_admin_or_pm());

drop policy if exists "comments_delete_own" on comments;
create policy "comments_delete_own"
  on comments for delete
  to authenticated
  using (author_id = auth.uid() or auth_user_role() = 'admin');

-- ============================================================================
-- ACTIVITY LOGS — read for admin/PM, insert by anyone (audit)
-- ============================================================================

drop policy if exists "logs_select_admin_pm" on activity_logs;
drop policy if exists "logs_select_internal" on activity_logs;
create policy "logs_select_admin_pm"
  on activity_logs for select
  to authenticated
  using (auth_is_admin_or_pm());

drop policy if exists "logs_insert_authenticated" on activity_logs;
create policy "logs_insert_authenticated"
  on activity_logs for insert
  to authenticated
  with check (true);

-- ============================================================================
-- AGENCY SETTINGS (singleton)
-- ============================================================================

drop policy if exists "agency_settings_select_internal" on agency_settings;
create policy "agency_settings_select_internal"
  on agency_settings for select
  to authenticated
  using (auth_user_role() is not null);

drop policy if exists "agency_settings_update_admin" on agency_settings;
create policy "agency_settings_update_admin"
  on agency_settings for update
  to authenticated
  using (auth_user_role() = 'admin')
  with check (auth_user_role() = 'admin');

-- ============================================================================
-- AGENCY MONTHLY GOALS (dashboard targets)
-- ============================================================================

drop policy if exists "agency_monthly_goals_select_staff" on agency_monthly_goals;
drop policy if exists "agency_monthly_goals_select_scoped" on agency_monthly_goals;
create policy "agency_monthly_goals_select_scoped"
  on agency_monthly_goals for select
  to authenticated
  using (
    auth_user_role() in ('admin'::user_role, 'finance'::user_role, 'commercial'::user_role)
  );

drop policy if exists "agency_monthly_goals_admin_write" on agency_monthly_goals;
create policy "agency_monthly_goals_admin_write"
  on agency_monthly_goals for insert
  to authenticated
  with check (auth_user_role() = 'admin');

drop policy if exists "agency_monthly_goals_admin_update" on agency_monthly_goals;
create policy "agency_monthly_goals_admin_update"
  on agency_monthly_goals for update
  to authenticated
  using (auth_user_role() = 'admin')
  with check (auth_user_role() = 'admin');

drop policy if exists "agency_monthly_goals_admin_delete" on agency_monthly_goals;
create policy "agency_monthly_goals_admin_delete"
  on agency_monthly_goals for delete
  to authenticated
  using (auth_user_role() = 'admin');

-- ============================================================================
-- USER NOTIFICATION PREFERENCES
-- ============================================================================

drop policy if exists "notif_prefs_select_own" on user_notification_preferences;
create policy "notif_prefs_select_own"
  on user_notification_preferences for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notif_prefs_upsert_own" on user_notification_preferences;
create policy "notif_prefs_upsert_own"
  on user_notification_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "notif_prefs_update_own" on user_notification_preferences;
create policy "notif_prefs_update_own"
  on user_notification_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- (No update / delete on logs — they're an audit trail.)

-- ============================================================================
-- DENY ANON ACCESS to all sensitive tables
-- ============================================================================
-- The anon role exists for the public Supabase API. We explicitly revoke
-- default privileges so even if RLS were misconfigured, anon could not read
-- internal data. Server code uses the service_role key (bypasses RLS) for
-- portal token validation and PDF generation.

revoke all on employees, clients, client_portals, projects, internal_projects,
              tasks, videos, editorial_calendars, video_templates, content_ideas,
              invoices, invoice_items, quotes, quote_items, payments, reports,
              documents, notifications, comments, activity_logs,
              agency_settings, agency_monthly_goals, user_notification_preferences,
              task_discord_messages, discord_channel_routes, discord_reminder_deliveries
       from anon;

revoke all on task_discord_messages, discord_channel_routes, discord_reminder_deliveries from authenticated;

-- ============================================================================
-- END OF POLICIES
-- ============================================================================
