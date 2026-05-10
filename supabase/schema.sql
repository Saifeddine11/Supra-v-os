-- ============================================================================
-- SUPRA V. AGENCY OS — DATABASE SCHEMA
-- ============================================================================
-- Version       : 1.0.0
-- Database      : PostgreSQL 15+ (Supabase)
-- Description   : Complete schema for the agency operating system.
--                 Includes auth integration, RBAC, full domain model.
-- ============================================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── ENUMS ──────────────────────────────────────────────────────────────────

-- User roles (used for RBAC across the app)
create type user_role as enum (
  'admin',
  'project_manager',
  'editor',
  'cameraman',
  'developer',
  'designer',
  'seo',
  'commercial',
  'community_manager',
  'finance',
  'client'
);

-- Client lifecycle status
create type client_status as enum (
  'prospect',
  'active',
  'pause',
  'terminated'
);

-- Contract types
create type contract_type as enum (
  'monthly',
  'one_shot',
  'retainer'
);

-- Generic project lifecycle
create type project_status as enum (
  'todo',
  'in_progress',
  'waiting_client',
  'waiting_content',
  'review',
  'validated',
  'delivered',
  'archived'
);

-- Task status
create type task_status as enum (
  'todo',
  'in_progress',
  'waiting_client',
  'waiting_team',
  'review',
  'blocked',
  'done',
  'archived'
);

-- Task priority
create type task_priority as enum ('low', 'normal', 'high', 'urgent');

-- Internal video production status (rich state machine)
create type video_status as enum (
  'idea',
  'brief_pending',
  'brief_validated',
  'shooting_planned',
  'shooting_done',
  'rushes_received',
  'editing',
  'internal_review',
  'sent_to_client',
  'client_revision',
  'validated',
  'published',
  'archived',
  'cancelled'
);

-- Public-facing video status (shown in client portal — sanitized)
create type video_public_status as enum (
  'topic_proposed',
  'brief_validated',
  'shooting_planned',
  'in_production',
  'in_editing',
  'in_validation',
  'revision_requested',
  'validated',
  'published'
);

-- Video format
create type video_format as enum (
  'reel',
  'story',
  'tiktok',
  'short',
  'long_form',
  'ad',
  'showcase'
);

-- Video platform
create type video_platform as enum (
  'instagram',
  'tiktok',
  'youtube',
  'youtube_shorts',
  'linkedin',
  'facebook',
  'ads_meta',
  'ads_google',
  'website'
);

-- Invoice status
create type invoice_status as enum (
  'draft',
  'sent',
  'pending',
  'paid',
  'overdue',
  'cancelled'
);

-- Quote status
create type quote_status as enum (
  'draft',
  'sent',
  'accepted',
  'refused',
  'expired',
  'converted'
);

-- Payment method
create type payment_method as enum (
  'bank_transfer',
  'cash',
  'card',
  'check',
  'other'
);

-- Notification type
create type notification_type as enum (
  'task_assigned',
  'task_overdue',
  'task_deadline_approaching',
  'deadline_soon',
  'client_validated',
  'client_revision_requested',
  'invoice_overdue',
  'invoice_due_soon',
  'invoice_sent',
  'invoice_paid',
  'quote_accepted',
  'quote_expiring',
  'quote_converted',
  'quota_incomplete',
  'employee_overloaded',
  'employee_task_not_updated',
  'report_due',
  'comment_added',
  'document_uploaded',
  'morning_summary',
  'evening_summary',
  'system'
);

create type notification_priority as enum ('low', 'normal', 'high', 'urgent');

-- Document type
create type document_type as enum (
  'video_final',
  'video_preview',
  'mockup',
  'logo',
  'brand_guide',
  'seo_report',
  'invoice_pdf',
  'quote_pdf',
  'contract',
  'brief',
  'rushes',
  'other',
  'roadmap'
);

-- Internal project priority
create type internal_priority as enum ('low', 'normal', 'high', 'critical');

-- Report type
create type report_type as enum (
  'weekly',
  'monthly',
  'project',
  'video_production',
  'seo',
  'social_media'
);

-- ============================================================================
-- USERS & EMPLOYEES
-- ============================================================================

-- Employees (1-1 with auth.users for staff members)
create table employees (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade unique,
  full_name       text not null,
  role            user_role not null default 'editor',
  email           text not null unique,
  phone           text,
  avatar_url      text,
  avatar_initials text,                -- "YK"
  avatar_color    text,                -- hex color
  is_active       boolean not null default true,
  weekly_capacity int not null default 40,  -- hours/week
  hire_date       date,
  notes_internal  text,
  manager_id      uuid references employees(id) on delete set null,
  operational_skills user_role[] not null default '{}',
  archived_at     timestamptz,
  must_change_password boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_employees_user on employees(user_id);
create index idx_employees_role on employees(role);
create index idx_employees_active on employees(is_active);
create index idx_employees_archived on employees(archived_at);

-- ============================================================================
-- CLIENTS
-- ============================================================================

create table clients (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  legal_name          text,
  sector              text not null,
  status              client_status not null default 'prospect',
  contract_type       contract_type not null default 'one_shot',

  -- Contact
  primary_contact     text,
  email               text,
  phone               text,
  whatsapp            text,
  address             text,
  city                text,
  country             text default 'Maroc',

  -- Visual identity
  logo_url            text,
  avatar_initials     text,
  avatar_color        text,

  -- Business
  services            text[] default '{}',           -- ["Vidéo","SEO",...]
  monthly_video_quota int default 0,
  monthly_fee         numeric(12,2) default 0,
  currency            text not null default 'MAD',

  -- Lifecycle
  start_date          date,
  end_date            date,

  -- Internal
  notes_internal      text,
  account_manager_id  uuid references employees(id) on delete set null,

  -- Audit
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null
);

create index idx_clients_status on clients(status);
create index idx_clients_account_manager on clients(account_manager_id);
create index idx_clients_sector on clients(sector);

-- ============================================================================
-- CLIENT PORTALS (token-based access)
-- ============================================================================

create table client_portals (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null unique references clients(id) on delete cascade,
  token           text not null unique,                 -- random 64-char token
  is_active       boolean not null default true,
  expires_at      timestamptz,
  last_accessed_at timestamptz,
  access_count    int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);

create index idx_portals_token on client_portals(token);
create index idx_portals_client on client_portals(client_id);

-- ============================================================================
-- PROJECTS (web/dev/SEO/branding/ads)
-- ============================================================================

create table projects (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references clients(id) on delete cascade,
  title             text not null,
  description       text,
  type              text not null,                   -- "Site Web", "SEO", "Branding"...
  status            project_status not null default 'todo',
  priority          task_priority not null default 'normal',
  progress          int not null default 0 check (progress between 0 and 100),

  -- Team
  lead_id           uuid references employees(id) on delete set null,
  team_ids          uuid[] default '{}',

  -- Dates
  start_date        date,
  deadline          date,
  delivered_at      timestamptz,

  -- Money
  budget            numeric(12,2),
  invoice_id        uuid,                            -- linked invoice (FK added later)

  -- Internal
  notes_internal    text,

  -- Audit
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null
);

create index idx_projects_client on projects(client_id);
create index idx_projects_lead on projects(lead_id);
create index idx_projects_status on projects(status);
create index idx_projects_deadline on projects(deadline);
create index idx_projects_priority on projects(priority);

-- ============================================================================
-- INTERNAL PROJECTS (Supra v. own initiatives)
-- ============================================================================

create table internal_projects (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  description     text,
  category        text,                              -- "SEO", "Marketing", "Product"
  status          project_status not null default 'todo',
  priority        internal_priority not null default 'normal',
  progress        int not null default 0 check (progress between 0 and 100),
  owner_id        uuid references employees(id) on delete set null,
  team_ids        uuid[] default '{}',
  start_date      date,
  deadline        date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);

create index idx_internal_status on internal_projects(status);
create index idx_internal_owner on internal_projects(owner_id);

-- ============================================================================
-- TASKS (the heart of the operations system)
-- ============================================================================

create table tasks (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  description       text,

  -- Linking (one of these may be set)
  project_id            uuid references projects(id) on delete cascade,
  internal_project_id   uuid references internal_projects(id) on delete cascade,
  client_id             uuid references clients(id) on delete set null,
  video_id              uuid,                          -- FK added later
  parent_task_id        uuid references tasks(id) on delete cascade,

  -- Assignment
  assignee_id       uuid references employees(id) on delete set null,
  watcher_ids       uuid[] default '{}',

  -- State
  status            task_status not null default 'todo',
  priority          task_priority not null default 'normal',
  progress          int not null default 0 check (progress between 0 and 100),

  -- Dates
  start_date        date,
  deadline          timestamptz,
  completed_at      timestamptz,

  -- Recurrence (simple)
  is_recurring      boolean not null default false,
  recurrence_pattern text,                              -- "weekly", "monthly", null

  -- Time tracking
  estimated_hours   numeric(5,2),
  actual_hours      numeric(5,2) default 0,

  -- Checklist (stored as jsonb array of {id, text, done})
  checklist         jsonb default '[]'::jsonb,

  -- Audit
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null
);

create index idx_tasks_assignee on tasks(assignee_id);
create index idx_tasks_project on tasks(project_id);
create index idx_tasks_internal_project on tasks(internal_project_id);
create index idx_tasks_client on tasks(client_id);
create index idx_tasks_status on tasks(status);
create index idx_tasks_deadline on tasks(deadline);
create index idx_tasks_priority on tasks(priority);
create index idx_tasks_parent on tasks(parent_task_id);

-- ============================================================================
-- VIDEOS (production)
-- ============================================================================

create table videos (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid not null references clients(id) on delete cascade,
  editorial_calendar_id uuid,                          -- FK added later

  -- Content
  title               text not null,
  topic               text,
  brief               text,
  type                text,                            -- "Tuto", "Showcase"...
  format              video_format,
  platform            video_platform,
  duration_seconds    int,

  -- Status
  status              video_status not null default 'idea',
  public_status       video_public_status not null default 'topic_proposed',
  priority            task_priority not null default 'normal',

  -- Team
  cameraman_id        uuid references employees(id) on delete set null,
  editor_id           uuid references employees(id) on delete set null,

  -- Dates
  shooting_date       timestamptz,
  delivery_deadline   date,
  publication_date    timestamptz,

  -- Files & links
  preview_url         text,
  final_url           text,
  rushes_storage_path text,                            -- supabase storage path

  -- Feedback
  client_feedback     text,
  revision_count      int not null default 0,

  -- Audit
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null
);

create index idx_videos_client on videos(client_id);
create index idx_videos_editor on videos(editor_id);
create index idx_videos_cameraman on videos(cameraman_id);
create index idx_videos_status on videos(status);
create index idx_videos_deadline on videos(delivery_deadline);
create index idx_videos_calendar on videos(editorial_calendar_id);

-- Add FK on tasks now that videos exists
alter table tasks add constraint fk_tasks_video
  foreign key (video_id) references videos(id) on delete set null;

-- ============================================================================
-- EDITORIAL CALENDARS (monthly per client)
-- ============================================================================

create table editorial_calendars (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references clients(id) on delete cascade,
  month           date not null,                   -- first day of month
  quota           int not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (client_id, month)
);

create index idx_calendars_client on editorial_calendars(client_id);
create index idx_calendars_month on editorial_calendars(month);

-- Add FK on videos now that calendars exists
alter table videos add constraint fk_videos_calendar
  foreign key (editorial_calendar_id) references editorial_calendars(id) on delete set null;

-- ============================================================================
-- VIDEO TEMPLATES (per sector)
-- ============================================================================

create table video_templates (
  id              uuid primary key default uuid_generate_v4(),
  sector          text not null,                   -- "Restaurant", "Hôtellerie"...
  title           text not null,
  description     text,
  format          video_format,
  duration_seconds int,
  brief_template  text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_templates_sector on video_templates(sector);

-- ============================================================================
-- CONTENT IDEAS (suggestions, generated or saved)
-- ============================================================================

create table content_ideas (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid references clients(id) on delete cascade,
  sector          text,
  title           text not null,
  description     text,
  format          video_format,
  platform        video_platform,
  estimated_duration int,
  is_used         boolean not null default false,
  used_video_id   uuid references videos(id) on delete set null,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);

create index idx_ideas_client on content_ideas(client_id);
create index idx_ideas_used on content_ideas(is_used);

-- ============================================================================
-- INVOICES
-- ============================================================================

create table invoices (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references clients(id) on delete restrict,
  ref               text not null unique,            -- "FAC-2026-001"

  -- Dates
  issue_date        date not null default current_date,
  due_date          date not null,
  sent_at           timestamptz,
  paid_at           timestamptz,

  -- Status
  status            invoice_status not null default 'draft',

  -- Amounts (calculated from items)
  subtotal          numeric(12,2) not null default 0,
  tax_rate          numeric(5,2) not null default 0,    -- e.g. 20.00 for 20%
  tax_amount        numeric(12,2) not null default 0,
  discount          numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  currency          text not null default 'MAD',

  -- Content
  notes             text,
  payment_terms     text,
  template          text not null default 'classic_premium',

  -- File
  pdf_url           text,                                -- supabase storage public url
  pdf_storage_path  text,

  -- Visibility
  visible_to_client boolean not null default true,

  -- Project link
  project_id        uuid references projects(id) on delete set null,

  -- Audit
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null
);

create index idx_invoices_client on invoices(client_id);
create index idx_invoices_status on invoices(status);
create index idx_invoices_due on invoices(due_date);
create index idx_invoices_ref on invoices(ref);

-- Now add the FK from projects.invoice_id (was forward-declared)
alter table projects add constraint fk_projects_invoice
  foreign key (invoice_id) references invoices(id) on delete set null;

-- Invoice line items
create table invoice_items (
  id              uuid primary key default uuid_generate_v4(),
  invoice_id      uuid not null references invoices(id) on delete cascade,
  position        int not null default 0,
  description     text not null,
  quantity        numeric(10,2) not null default 1,
  unit            text,                              -- "vidéo", "h", "page"...
  unit_price      numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  created_at      timestamptz not null default now()
);

create index idx_invoice_items_invoice on invoice_items(invoice_id);

-- ============================================================================
-- QUOTES (devis)
-- ============================================================================

create table quotes (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references clients(id) on delete restrict,
  ref               text not null unique,            -- "DEV-2026-001"

  -- Dates
  issue_date        date not null default current_date,
  valid_until       date not null,
  sent_at           timestamptz,
  decided_at        timestamptz,

  status            quote_status not null default 'draft',

  -- Amounts
  subtotal          numeric(12,2) not null default 0,
  tax_rate          numeric(5,2) not null default 0,
  tax_amount        numeric(12,2) not null default 0,
  discount          numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  currency          text not null default 'MAD',

  -- Content
  notes             text,
  conditions        text,
  template          text not null default 'supra_premium_black_orange',

  -- Commercial proposal (premium devis)
  proposal_title           text,
  package_name             text,
  project_object           text,
  strategic_positioning    text,
  commercial_recommendation text,
  execution_assumptions    text,
  strategic_value_blocks   jsonb not null default '[]'::jsonb,
  promotional_label        text,
  promotional_terms        text,
  discount_mode            text not null default 'fixed',
  discount_percent         numeric(5,2),
  first_month_total        numeric(12,2),
  recurring_monthly_total  numeric(12,2),
  commitment_months      integer,
  ads_budget_note          text,
  maintenance_note         text,
  revision_policy_note     text,
  payment_terms            text,
  include_signature_block  boolean not null default true,

  -- File
  pdf_url           text,
  pdf_storage_path  text,

  -- Conversion
  converted_invoice_id uuid references invoices(id) on delete set null,

  -- Visibility
  visible_to_client boolean not null default true,

  -- Audit
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null
);

create index idx_quotes_client on quotes(client_id);
create index idx_quotes_status on quotes(status);
create index idx_quotes_ref on quotes(ref);

create table quote_items (
  id              uuid primary key default uuid_generate_v4(),
  quote_id        uuid not null references quotes(id) on delete cascade,
  position        int not null default 0,
  description     text not null,
  service_name    text not null default '',
  detail_text     text,
  strategic_explanation text,
  is_optional     boolean not null default false,
  is_recommended  boolean not null default false,
  quantity        numeric(10,2) not null default 1,
  unit            text,
  unit_price      numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  created_at      timestamptz not null default now()
);

create index idx_quote_items_quote on quote_items(quote_id);

-- ============================================================================
-- PAYMENTS
-- ============================================================================

create table payments (
  id              uuid primary key default uuid_generate_v4(),
  invoice_id      uuid not null references invoices(id) on delete restrict,
  client_id       uuid not null references clients(id) on delete restrict,
  amount          numeric(12,2) not null,
  currency        text not null default 'MAD',
  method          payment_method not null default 'bank_transfer',
  payment_date    date not null default current_date,
  reference       text,                                -- bank ref, check #, etc
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);

create index idx_payments_invoice on payments(invoice_id);
create index idx_payments_client on payments(client_id);
create index idx_payments_date on payments(payment_date);

-- ============================================================================
-- REPORTS
-- ============================================================================

create table reports (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references clients(id) on delete cascade,
  type              report_type not null,
  title             text not null,
  period_start      date,
  period_end        date,

  -- Content
  summary           text,
  highlights        jsonb default '[]'::jsonb,         -- [{title, description}]
  metrics           jsonb default '{}'::jsonb,         -- {videos_delivered: 5, ...}
  next_actions      text,
  recommendations   text,

  -- File
  pdf_url           text,
  pdf_storage_path  text,
  whatsapp_text     text,                              -- copy-pasteable

  -- Visibility
  visible_to_client boolean not null default true,
  sent_at           timestamptz,

  -- Audit
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null
);

create index idx_reports_client on reports(client_id);
create index idx_reports_period on reports(period_start, period_end);

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

create table documents (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid references clients(id) on delete cascade,
  project_id        uuid references projects(id) on delete cascade,
  video_id          uuid references videos(id) on delete cascade,

  name              text not null,
  type              document_type not null,
  description       text,

  -- File
  file_url          text,
  file_storage_path text,
  file_size         bigint,
  mime_type         text,
  external_link     text,                              -- if hosted elsewhere

  -- Visibility
  visible_to_client boolean not null default false,

  archived_at       timestamptz,

  -- Période couverte (ex. roadmap mensuelle)
  period_start      date,
  period_end        date,

  -- Audit
  uploaded_at       timestamptz not null default now(),
  uploaded_by       uuid references auth.users(id) on delete set null
);

create index idx_documents_client on documents(client_id);
create index idx_documents_project on documents(project_id);
create index idx_documents_video on documents(video_id);
create index idx_documents_visible on documents(visible_to_client);
create index idx_documents_archived on documents(archived_at);
create index idx_documents_client_type on documents(client_id, type) where client_id is not null;

-- ============================================================================
-- AGENCY MONTHLY GOALS (dashboard)
-- ============================================================================

create table agency_monthly_goals (
  id              uuid primary key default gen_random_uuid(),
  year            int not null check (year >= 2020 and year <= 2100),
  month           int not null check (month >= 1 and month <= 12),
  revenue_goal    numeric(14, 2) not null default 0,
  client_goal     int,
  video_goal      int,
  task_goal       int,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (year, month)
);

create index idx_agency_monthly_goals_year_month on agency_monthly_goals(year desc, month desc);

-- ============================================================================
-- AGENCY SETTINGS (singleton, id = 1)
-- ============================================================================

create table agency_settings (
  id                  smallint primary key default 1 check (id = 1),
  agency_name         text,
  logo_url            text,
  email               text,
  phone               text,
  address             text,
  website             text,
  tax_id              text,
  invoice_prefix      text default 'FAC-',
  quote_prefix        text default 'DEV-',
  default_currency    text default 'MAD',
  default_payment_terms text,
  default_tax_rate    numeric(5, 2) default 20,
  portal_base_url     text,
  portal_show_branding boolean not null default true,
  updated_at          timestamptz not null default now()
);

-- ============================================================================
-- USER NOTIFICATION PREFERENCES
-- ============================================================================

create table user_notification_preferences (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  email_reminders_enabled   boolean not null default true,
  morning_reminder_enabled  boolean not null default true,
  evening_summary_enabled   boolean not null default true,
  deadline_alerts_enabled   boolean not null default true,
  updated_at                timestamptz not null default now()
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

create table notifications (
  id                  uuid primary key default uuid_generate_v4(),
  recipient_user_id   uuid not null references auth.users(id) on delete cascade,
  type                notification_type not null,
  priority            notification_priority not null default 'normal',
  title               text not null,
  message             text,

  -- Polymorphic link to related entity
  related_entity_type text,                          -- "task", "invoice", "video"
  related_entity_id   uuid,
  link_url            text,                          -- in-app link

  -- State
  is_read             boolean not null default false,
  read_at             timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_notifications_recipient on notifications(recipient_user_id);
create index idx_notifications_unread on notifications(recipient_user_id, is_read);
create index idx_notifications_created on notifications(created_at desc);

-- ============================================================================
-- COMMENTS (polymorphic on tasks/videos/projects)
-- ============================================================================

create table comments (
  id              uuid primary key default uuid_generate_v4(),
  entity_type     text not null,                     -- "task", "video", "project"
  entity_id       uuid not null,
  author_id       uuid references auth.users(id) on delete set null,
  body            text not null,
  is_internal     boolean not null default true,     -- internal-only or visible to client
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_comments_entity on comments(entity_type, entity_id);

-- ============================================================================
-- ACTIVITY LOGS (audit trail)
-- ============================================================================

create table activity_logs (
  id              uuid primary key default uuid_generate_v4(),
  actor_user_id   uuid references auth.users(id) on delete set null,
  actor_label     text,                              -- "Sif Eddine" or "Client portal"
  action          text not null,                     -- "created", "updated", "validated"
  entity_type     text not null,
  entity_id       uuid,
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index idx_logs_entity on activity_logs(entity_type, entity_id);
create index idx_logs_actor on activity_logs(actor_user_id);
create index idx_logs_created on activity_logs(created_at desc);

-- ============================================================================
-- TRIGGERS — Auto-update `updated_at`
-- ============================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in select unnest(array[
    'employees','clients','client_portals','projects','internal_projects',
    'tasks','videos','editorial_calendars','video_templates','invoices',
    'quotes','reports','comments','agency_monthly_goals'
  ]) loop
    execute format('drop trigger if exists trg_%I_updated_at on %I', t, t);
    execute format(
      'create trigger trg_%I_updated_at before update on %I
       for each row execute function set_updated_at()', t, t);
  end loop;
end$$;

-- Employees: non-admins cannot self-escalate role / status / email
create or replace function employees_enforce_update_rls()
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
  if jwt_role = 'service_role' then
    return new;
  end if;

  select e.role into actor_role
  from employees e
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
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email
     or new.user_id is distinct from old.user_id
     or new.archived_at is distinct from old.archived_at
     or new.notes_internal is distinct from old.notes_internal
     or new.full_name is distinct from old.full_name
     or new.hire_date is distinct from old.hire_date
     or new.manager_id is distinct from old.manager_id
     or new.operational_skills is distinct from old.operational_skills
  then
    raise exception 'Seuls les administrateurs peuvent modifier ces champs.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists employees_enforce_update_rls on employees;
create trigger employees_enforce_update_rls
  before update on employees
  for each row
  execute function employees_enforce_update_rls();

-- ============================================================================
-- TRIGGERS — Invoice / Quote item totals auto-calculation
-- ============================================================================

create or replace function calc_line_total()
returns trigger as $$
begin
  new.total = coalesce(new.quantity, 0) * coalesce(new.unit_price, 0);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_invoice_items_total on invoice_items;
create trigger trg_invoice_items_total before insert or update on invoice_items
for each row execute function calc_line_total();

drop trigger if exists trg_quote_items_total on quote_items;
create trigger trg_quote_items_total before insert or update on quote_items
for each row execute function calc_line_total();

-- Recalculate invoice totals when items change
create or replace function recalc_invoice_totals()
returns trigger as $$
declare
  v_invoice_id uuid;
  v_subtotal numeric;
  v_tax_rate numeric;
  v_discount numeric;
begin
  v_invoice_id = coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(total), 0) into v_subtotal
  from invoice_items where invoice_id = v_invoice_id;

  select tax_rate, discount into v_tax_rate, v_discount
  from invoices where id = v_invoice_id;

  update invoices set
    subtotal = v_subtotal,
    tax_amount = round((v_subtotal - coalesce(v_discount,0)) * coalesce(v_tax_rate,0) / 100, 2),
    total = round((v_subtotal - coalesce(v_discount,0)) * (1 + coalesce(v_tax_rate,0)/100), 2)
  where id = v_invoice_id;

  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_invoice_recalc on invoice_items;
create trigger trg_invoice_recalc after insert or update or delete on invoice_items
for each row execute function recalc_invoice_totals();

create or replace function recalc_quote_totals()
returns trigger as $$
declare
  v_quote_id uuid;
  v_subtotal numeric;
  v_tax_rate numeric;
  v_discount numeric;
begin
  v_quote_id = coalesce(new.quote_id, old.quote_id);

  select coalesce(sum(total), 0) into v_subtotal
  from quote_items where quote_id = v_quote_id;

  select tax_rate, discount into v_tax_rate, v_discount
  from quotes where id = v_quote_id;

  update quotes set
    subtotal = v_subtotal,
    tax_amount = round((v_subtotal - coalesce(v_discount,0)) * coalesce(v_tax_rate,0) / 100, 2),
    total = round((v_subtotal - coalesce(v_discount,0)) * (1 + coalesce(v_tax_rate,0)/100), 2)
  where id = v_quote_id;

  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_quote_recalc on quote_items;
create trigger trg_quote_recalc after insert or update or delete on quote_items
for each row execute function recalc_quote_totals();

-- ============================================================================
-- TRIGGERS — Auto-mark invoices as overdue
-- ============================================================================
-- Note: Run via cron (see daily-reminders edge function)
create or replace function mark_overdue_invoices()
returns void as $$
begin
  update invoices
  set status = 'overdue', updated_at = now()
  where status in ('sent', 'pending')
    and due_date < current_date;
end;
$$ language plpgsql;

-- ============================================================================
-- HELPER FUNCTIONS — Used by RLS and app logic
-- ============================================================================

-- Get the calling user's role (or null)
create or replace function auth_user_role()
returns user_role as $$
declare r user_role;
begin
  select role into r from employees where user_id = auth.uid() limit 1;
  return r;
end;
$$ language plpgsql stable security definer;

-- Get the calling user's employee_id (or null)
create or replace function auth_employee_id()
returns uuid as $$
declare e uuid;
begin
  select id into e from employees where user_id = auth.uid() limit 1;
  return e;
end;
$$ language plpgsql stable security definer;

-- Is the user an admin or PM?
create or replace function auth_is_admin_or_pm()
returns boolean as $$
begin
  return auth_user_role() in ('admin', 'project_manager');
end;
$$ language plpgsql stable security definer;

-- Auto-generate next invoice ref
create or replace function next_invoice_ref()
returns text as $$
declare
  v_year text;
  v_count int;
begin
  v_year = to_char(current_date, 'YYYY');
  select count(*) + 1 into v_count
  from invoices where ref like 'FAC-' || v_year || '-%';
  return 'FAC-' || v_year || '-' || lpad(v_count::text, 3, '0');
end;
$$ language plpgsql;

create or replace function next_quote_ref()
returns text as $$
declare
  v_year text;
  v_count int;
begin
  v_year = to_char(current_date, 'YYYY');
  select count(*) + 1 into v_count
  from quotes where ref like 'DEV-' || v_year || '-%';
  return 'DEV-' || v_year || '-' || lpad(v_count::text, 3, '0');
end;
$$ language plpgsql;

-- ============================================================================
-- VIEWS — Useful aggregations
-- ============================================================================

-- Employee workload summary
create or replace view v_employee_workload as
select
  e.id,
  e.full_name,
  e.role,
  e.weekly_capacity,
  count(t.id) filter (where t.status not in ('done','archived')) as active_tasks,
  count(t.id) filter (where t.priority = 'urgent' and t.status not in ('done','archived')) as urgent_tasks,
  count(t.id) filter (where t.deadline < now() and t.status not in ('done','archived')) as overdue_tasks,
  coalesce(sum(t.estimated_hours) filter (where t.status not in ('done','archived')), 0) as estimated_hours,
  case
    when e.weekly_capacity > 0
    then round(
      coalesce(sum(t.estimated_hours) filter (where t.status not in ('done','archived')), 0)
      * 100.0 / e.weekly_capacity
    )
    else 0
  end as load_percent
from employees e
left join tasks t on t.assignee_id = e.id
where e.is_active = true
group by e.id, e.full_name, e.role, e.weekly_capacity;

-- Client editorial summary (current month)
create or replace view v_client_editorial_status as
select
  c.id as client_id,
  c.name as client_name,
  c.monthly_video_quota as quota,
  count(v.id) filter (where v.status in ('published', 'validated')) as delivered,
  count(v.id) filter (where v.status not in ('published', 'validated', 'archived', 'cancelled')) as in_progress,
  count(v.id) filter (where v.status = 'idea') as ideas
from clients c
left join videos v on v.client_id = c.id
  and date_trunc('month', v.delivery_deadline) = date_trunc('month', current_date)
where c.status = 'active' and c.monthly_video_quota > 0
group by c.id, c.name, c.monthly_video_quota;

-- Revenue summary (paid invoices, current month)
create or replace view v_revenue_summary as
select
  date_trunc('month', issue_date)::date as month,
  count(*) filter (where status = 'paid') as paid_count,
  count(*) filter (where status in ('sent', 'pending')) as pending_count,
  count(*) filter (where status = 'overdue') as overdue_count,
  coalesce(sum(total) filter (where status = 'paid'), 0) as paid_amount,
  coalesce(sum(total) filter (where status in ('sent', 'pending')), 0) as pending_amount,
  coalesce(sum(total) filter (where status = 'overdue'), 0) as overdue_amount
from invoices
group by date_trunc('month', issue_date);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
