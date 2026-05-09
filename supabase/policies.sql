-- ============================================================================
-- SUPRA V. AGENCY OS — ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- Apply AFTER schema.sql has been run.
--
-- Strategy:
--   - All tables have RLS enabled.
--   - admin / project_manager: full access (select+modify).
--   - Employees: read all internal data they need to do their job, but only
--     modify what they own/are assigned to. Some tables (invoices, quotes,
--     payments) are restricted to admin + commercial + finance.
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
alter table videos               enable row level security;
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
alter table user_notification_preferences enable row level security;

-- ============================================================================
-- EMPLOYEES
-- ============================================================================
-- All authenticated employees can see the team roster. Only admins modify.

drop policy if exists "employees_select_authenticated" on employees;
create policy "employees_select_authenticated"
  on employees for select
  to authenticated
  using (true);

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
-- Internal staff can read all clients. Modifications: admin / PM / commercial.

drop policy if exists "clients_select_internal" on clients;
create policy "clients_select_internal"
  on clients for select
  to authenticated
  using (auth_user_role() is not null);

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
create policy "projects_select_internal"
  on projects for select
  to authenticated
  using (auth_user_role() is not null);

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
create policy "internal_projects_select"
  on internal_projects for select
  to authenticated
  using (auth_user_role() is not null);

drop policy if exists "internal_projects_modify_admin_pm" on internal_projects;
create policy "internal_projects_modify_admin_pm"
  on internal_projects for all
  to authenticated
  using (auth_is_admin_or_pm())
  with check (auth_is_admin_or_pm());

-- ============================================================================
-- TASKS
-- ============================================================================
-- Everyone reads tasks (helpful for context / handoffs).
-- Modifications: admin/PM, OR the assignee for their own tasks.

drop policy if exists "tasks_select_internal" on tasks;
create policy "tasks_select_internal"
  on tasks for select
  to authenticated
  using (auth_user_role() is not null);

drop policy if exists "tasks_insert_authorized" on tasks;
create policy "tasks_insert_authorized"
  on tasks for insert
  to authenticated
  with check (auth_user_role() is not null);

drop policy if exists "tasks_update_assigned_or_admin" on tasks;
create policy "tasks_update_assigned_or_admin"
  on tasks for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or assignee_id = auth_employee_id()
    or auth_employee_id() = any(watcher_ids)
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
create policy "videos_select_internal"
  on videos for select
  to authenticated
  using (auth_user_role() is not null);

drop policy if exists "videos_insert_authorized" on videos;
create policy "videos_insert_authorized"
  on videos for insert
  to authenticated
  with check (auth_user_role() in ('admin', 'project_manager', 'editor', 'cameraman', 'commercial'));

drop policy if exists "videos_update_assigned_or_admin" on videos;
create policy "videos_update_assigned_or_admin"
  on videos for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or editor_id = auth_employee_id()
    or cameraman_id = auth_employee_id()
  );

drop policy if exists "videos_delete_admin_pm" on videos;
create policy "videos_delete_admin_pm"
  on videos for delete
  to authenticated
  using (auth_is_admin_or_pm());

-- ============================================================================
-- EDITORIAL CALENDARS
-- ============================================================================

drop policy if exists "calendars_select_internal" on editorial_calendars;
create policy "calendars_select_internal"
  on editorial_calendars for select
  to authenticated
  using (auth_user_role() is not null);

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
create policy "invoices_select_financial"
  on invoices for select
  to authenticated
  using (auth_user_role() in ('admin', 'project_manager', 'commercial', 'finance'));

drop policy if exists "invoices_modify_financial" on invoices;
create policy "invoices_modify_financial"
  on invoices for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));

drop policy if exists "invoice_items_select" on invoice_items;
create policy "invoice_items_select"
  on invoice_items for select
  to authenticated
  using (auth_user_role() in ('admin', 'project_manager', 'commercial', 'finance'));

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
create policy "quotes_select_financial"
  on quotes for select
  to authenticated
  using (auth_user_role() in ('admin', 'project_manager', 'commercial', 'finance'));

drop policy if exists "quotes_modify_financial" on quotes;
create policy "quotes_modify_financial"
  on quotes for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));

drop policy if exists "quote_items_select" on quote_items;
create policy "quote_items_select"
  on quote_items for select
  to authenticated
  using (auth_user_role() in ('admin', 'project_manager', 'commercial', 'finance'));

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
create policy "payments_select_financial"
  on payments for select
  to authenticated
  using (auth_user_role() in ('admin', 'project_manager', 'commercial', 'finance'));

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
create policy "reports_select_internal"
  on reports for select
  to authenticated
  using (auth_user_role() is not null);

drop policy if exists "reports_modify_admin_pm" on reports;
create policy "reports_modify_admin_pm"
  on reports for all
  to authenticated
  using (auth_is_admin_or_pm())
  with check (auth_is_admin_or_pm());

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

drop policy if exists "documents_select_internal" on documents;
create policy "documents_select_internal"
  on documents for select
  to authenticated
  using (auth_user_role() is not null);

drop policy if exists "documents_modify_internal" on documents;
create policy "documents_modify_internal"
  on documents for all
  to authenticated
  using (auth_user_role() is not null)
  with check (auth_user_role() is not null);

-- ============================================================================
-- NOTIFICATIONS — users can only see their own
-- ============================================================================

drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own"
  on notifications for select
  to authenticated
  using (recipient_user_id = auth.uid() or auth_user_role() = 'admin');

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
create policy "comments_select_internal"
  on comments for select
  to authenticated
  using (auth_user_role() is not null);

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
create policy "logs_select_internal"
  on activity_logs for select
  to authenticated
  using (auth_user_role() is not null);

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
              agency_settings, user_notification_preferences
       from anon;

-- ============================================================================
-- END OF POLICIES
-- ============================================================================
