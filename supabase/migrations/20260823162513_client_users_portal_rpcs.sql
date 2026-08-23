-- ============================================================================
-- Phase 0 — Client Auth foundation (additive, fail-closed)
-- ============================================================================
-- Prepares future client mobile login without changing the token portal,
-- staff web/mobile, or any UI.
--
-- Additive only:
--   * public.client_users
--   * public.auth_client_id()
--   * public.portal_my_client()
--   * public.portal_my_projects()
--   * public.portal_my_videos()
--   * RLS tightening on notifications / activity_logs / comments /
--     user_notification_preferences
--
-- Not done here:
--   * no employees.role = 'client'
--   * no client rows in employees
--   * no direct SELECT policies on videos / projects / tasks / employees
--   * no change to client_portals token flow
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. client_users — Auth identities for clients (separate from employees)
-- ---------------------------------------------------------------------------

create table if not exists public.client_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  full_name text,
  email text not null,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint client_users_email_not_blank check (length(trim(email)) > 0)
);

comment on table public.client_users is
  'Client Auth identities. Separate from employees. Multiple users per client allowed. Never put clients in employees.';

comment on column public.client_users.user_id is
  'Supabase Auth user. Unique: one Auth user maps to at most one client_users row.';

comment on column public.client_users.client_id is
  'Owning client. Multiple client_users per client are allowed.';

create index if not exists idx_client_users_client_id
  on public.client_users (client_id);

create index if not exists idx_client_users_email
  on public.client_users (email);

create index if not exists idx_client_users_active_user
  on public.client_users (user_id)
  where is_active = true;

drop trigger if exists trg_client_users_updated_at on public.client_users;
create trigger trg_client_users_updated_at
  before update on public.client_users
  for each row
  execute function public.set_updated_at();

-- Staff Auth users must never also be client_users (and the reverse).
create or replace function public.client_users_reject_staff()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if exists (
    select 1
    from public.employees e
    where e.user_id is not null
      and e.user_id = new.user_id
  ) then
    raise exception 'client_users cannot reference a staff auth user';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_client_users_reject_staff on public.client_users;
create trigger trg_client_users_reject_staff
  before insert or update of user_id on public.client_users
  for each row
  execute function public.client_users_reject_staff();

create or replace function public.employees_reject_client_user()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.user_id is not null
     and exists (
       select 1
       from public.client_users cu
       where cu.user_id = new.user_id
     )
  then
    raise exception 'employees cannot reference a client auth user';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employees_reject_client_user on public.employees;
create trigger trg_employees_reject_client_user
  before insert or update of user_id on public.employees
  for each row
  execute function public.employees_reject_client_user();

alter table public.client_users enable row level security;

revoke all on table public.client_users from anon;
revoke all on table public.client_users from public;

grant select, insert, update, delete on table public.client_users to authenticated;
grant all on table public.client_users to service_role;

-- No client SELECT/INSERT/UPDATE policies: clients use portal_* RPCs only.
-- Staff admin / project_manager can manage rows (Phase 1 will use service role).
drop policy if exists "client_users_select_staff" on public.client_users;
create policy "client_users_select_staff"
  on public.client_users
  for select
  to authenticated
  using (public.auth_is_admin_or_pm());

drop policy if exists "client_users_insert_staff" on public.client_users;
create policy "client_users_insert_staff"
  on public.client_users
  for insert
  to authenticated
  with check (public.auth_is_admin_or_pm());

drop policy if exists "client_users_update_staff" on public.client_users;
create policy "client_users_update_staff"
  on public.client_users
  for update
  to authenticated
  using (public.auth_is_admin_or_pm())
  with check (public.auth_is_admin_or_pm());

drop policy if exists "client_users_delete_admin" on public.client_users;
create policy "client_users_delete_admin"
  on public.client_users
  for delete
  to authenticated
  using (public.auth_is_admin());

-- ---------------------------------------------------------------------------
-- 2. auth_client_id() — fail-closed helper
-- ---------------------------------------------------------------------------

create or replace function public.auth_client_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  -- Staff identities must never resolve as clients.
  if exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
  ) then
    return null;
  end if;

  select cu.client_id
    into cid
  from public.client_users cu
  where cu.user_id = auth.uid()
    and cu.is_active = true
  limit 1;

  return cid;
end;
$$;

comment on function public.auth_client_id() is
  'Returns the active client_users.client_id for the current Auth user, else null. Fail-closed. SECURITY DEFINER.';

revoke all on function public.auth_client_id() from public;
revoke all on function public.auth_client_id() from anon;
grant execute on function public.auth_client_id() to authenticated;
grant execute on function public.auth_client_id() to service_role;

-- ---------------------------------------------------------------------------
-- 3. Client-safe RPCs (whitelisted columns only — no direct table SELECT)
-- ---------------------------------------------------------------------------

create or replace function public.portal_my_client()
returns table (
  id uuid,
  name text,
  monthly_video_quota integer,
  currency text,
  color_hex text,
  color_label text,
  client_user_id uuid,
  full_name text,
  email text,
  must_change_password boolean
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  cid uuid;
begin
  cid := public.auth_client_id();
  if cid is null then
    return;
  end if;

  return query
  select
    c.id,
    c.name,
    c.monthly_video_quota,
    c.currency,
    c.color_hex,
    c.color_label,
    cu.id,
    cu.full_name,
    cu.email,
    cu.must_change_password
  from public.clients c
  join public.client_users cu
    on cu.client_id = c.id
   and cu.user_id = auth.uid()
   and cu.is_active = true
  where c.id = cid
  limit 1;
end;
$$;

comment on function public.portal_my_client() is
  'Client-safe RPC. Returns the current user''s client org + own identity. No internal notes, fees, or staff fields.';

create or replace function public.portal_my_projects()
returns table (
  id uuid,
  title text,
  status public.project_status,
  progress integer,
  deadline date,
  type text,
  delivered_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  cid uuid;
begin
  cid := public.auth_client_id();
  if cid is null then
    return;
  end if;

  return query
  select
    p.id,
    p.title,
    p.status,
    p.progress,
    p.deadline,
    p.type,
    p.delivered_at
  from public.projects p
  where p.client_id = cid
  order by p.updated_at desc;
end;
$$;

comment on function public.portal_my_projects() is
  'Client-safe RPC. Own-client projects only. No notes_internal, budget, lead_id, team_ids, invoice_id.';

create or replace function public.portal_my_videos()
returns table (
  id uuid,
  title text,
  public_status public.video_public_status,
  shooting_date timestamptz,
  delivery_deadline date,
  client_delivery_at timestamptz,
  publication_date timestamptz,
  preview_url text,
  final_url text
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  cid uuid;
begin
  cid := public.auth_client_id();
  if cid is null then
    return;
  end if;

  -- Mirrors src/lib/portal/video-disclosure.ts
  -- isPortalListedVideo + portalVideoExposeMediaUrls.
  return query
  select
    v.id,
    v.title,
    v.public_status,
    v.shooting_date,
    v.delivery_deadline,
    v.client_delivery_at,
    v.publication_date,
    case
      when v.public_status in (
        'in_validation'::public.video_public_status,
        'revision_requested'::public.video_public_status,
        'validated'::public.video_public_status,
        'published'::public.video_public_status
      )
      or v.status in (
        'sent_to_client'::public.video_status,
        'client_revision'::public.video_status,
        'validated'::public.video_status,
        'published'::public.video_status
      )
      then v.preview_url
      else null
    end as preview_url,
    case
      when v.public_status in (
        'in_validation'::public.video_public_status,
        'revision_requested'::public.video_public_status,
        'validated'::public.video_public_status,
        'published'::public.video_public_status
      )
      or v.status in (
        'sent_to_client'::public.video_status,
        'client_revision'::public.video_status,
        'validated'::public.video_status,
        'published'::public.video_status
      )
      then v.final_url
      else null
    end as final_url
  from public.videos v
  where v.client_id = cid
    and v.status not in (
      'archived'::public.video_status,
      'cancelled'::public.video_status
    )
    and v.public_status in (
      'topic_proposed'::public.video_public_status,
      'brief_validated'::public.video_public_status,
      'shooting_planned'::public.video_public_status,
      'in_production'::public.video_public_status,
      'in_editing'::public.video_public_status,
      'in_validation'::public.video_public_status,
      'revision_requested'::public.video_public_status,
      'validated'::public.video_public_status,
      'published'::public.video_public_status
    )
  order by v.updated_at desc;
end;
$$;

comment on function public.portal_my_videos() is
  'Client-safe RPC. Own-client videos, public_status only. Media URLs follow portalVideoExposeMediaUrls. No internal status, notes, rushes, team ids.';

revoke all on function public.portal_my_client() from public;
revoke all on function public.portal_my_client() from anon;
grant execute on function public.portal_my_client() to authenticated;
grant execute on function public.portal_my_client() to service_role;

revoke all on function public.portal_my_projects() from public;
revoke all on function public.portal_my_projects() from anon;
grant execute on function public.portal_my_projects() to authenticated;
grant execute on function public.portal_my_projects() to service_role;

revoke all on function public.portal_my_videos() from public;
revoke all on function public.portal_my_videos() from anon;
grant execute on function public.portal_my_videos() to authenticated;
grant execute on function public.portal_my_videos() to service_role;

revoke all on function public.client_users_reject_staff() from public;
revoke all on function public.client_users_reject_staff() from anon;
revoke all on function public.client_users_reject_staff() from authenticated;

revoke all on function public.employees_reject_client_user() from public;
revoke all on function public.employees_reject_client_user() from anon;
revoke all on function public.employees_reject_client_user() from authenticated;

-- ---------------------------------------------------------------------------
-- 4. Harden risky INSERT / prefs policies (staff-only writes)
--    Staff web inserts notifications via service role; activity_logs via
--    authenticated staff JWT (src/lib/activity/log-activity.ts).
-- ---------------------------------------------------------------------------

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated"
  on public.notifications
  for insert
  to authenticated
  with check (public.auth_employee_id() is not null);

drop policy if exists "logs_insert_authenticated" on public.activity_logs;
create policy "logs_insert_authenticated"
  on public.activity_logs
  for insert
  to authenticated
  with check (public.auth_employee_id() is not null);

-- Recheck: comments_insert_internal already required auth_user_role() IS NOT NULL
-- (employees-backed). Tighten to auth_employee_id() so future client Auth
-- users cannot insert internal comments.
drop policy if exists "comments_insert_internal" on public.comments;
create policy "comments_insert_internal"
  on public.comments
  for insert
  to authenticated
  with check (
    public.auth_employee_id() is not null
    and author_id = auth.uid()
  );

drop policy if exists "notif_prefs_select_own" on public.user_notification_preferences;
create policy "notif_prefs_select_own"
  on public.user_notification_preferences
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.auth_employee_id() is not null
  );

drop policy if exists "notif_prefs_upsert_own" on public.user_notification_preferences;
create policy "notif_prefs_upsert_own"
  on public.user_notification_preferences
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.auth_employee_id() is not null
  );

drop policy if exists "notif_prefs_update_own" on public.user_notification_preferences;
create policy "notif_prefs_update_own"
  on public.user_notification_preferences
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.auth_employee_id() is not null
  )
  with check (
    user_id = auth.uid()
    and public.auth_employee_id() is not null
  );
