-- P1: private Storage buckets, documents archive, agency settings, notification prefs, activity log read for staff

-- ---------------------------------------------------------------------------
-- Storage buckets (private by default; app uses signed URLs + service role uploads)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('documents', 'documents', false, 52428800),
  ('deliverables', 'deliverables', false, 52428800),
  ('reports', 'reports', false, 52428800),
  ('quotes', 'quotes', false, 52428800),
  ('invoices', 'invoices', false, 52428800)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- ---------------------------------------------------------------------------
-- Documents: soft archive
-- ---------------------------------------------------------------------------
alter table documents
  add column if not exists archived_at timestamptz;

create index if not exists idx_documents_archived on documents (archived_at);

-- ---------------------------------------------------------------------------
-- Agency settings (singleton row id = 1)
-- ---------------------------------------------------------------------------
create table if not exists agency_settings (
  id smallint primary key default 1 check (id = 1),
  agency_name text,
  logo_url text,
  email text,
  phone text,
  address text,
  website text,
  tax_id text,
  invoice_prefix text default 'FAC-',
  quote_prefix text default 'DEV-',
  default_currency text default 'MAD',
  default_payment_terms text,
  default_tax_rate numeric(5, 2) default 20,
  portal_base_url text,
  portal_show_branding boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into agency_settings (id)
values (1)
on conflict (id) do nothing;

alter table agency_settings enable row level security;

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

-- ---------------------------------------------------------------------------
-- Per-user notification / email cron preferences
-- ---------------------------------------------------------------------------
create table if not exists user_notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_reminders_enabled boolean not null default true,
  morning_reminder_enabled boolean not null default true,
  evening_summary_enabled boolean not null default true,
  deadline_alerts_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table user_notification_preferences enable row level security;

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

-- ---------------------------------------------------------------------------
-- Activity logs: all internal staff can read (not exposed to portal / anon)
-- ---------------------------------------------------------------------------
drop policy if exists "logs_select_admin_pm" on activity_logs;
drop policy if exists "logs_select_internal" on activity_logs;
create policy "logs_select_internal"
  on activity_logs for select
  to authenticated
  using (auth_user_role() is not null);

-- ---------------------------------------------------------------------------
-- Hardening: anon cannot touch new tables
-- ---------------------------------------------------------------------------
revoke all on agency_settings, user_notification_preferences from anon;
