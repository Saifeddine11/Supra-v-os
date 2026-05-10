-- Objectifs mensuels agence (dashboard) + type document roadmap + période sur documents

-- ---------------------------------------------------------------------------
-- agency_monthly_goals
-- ---------------------------------------------------------------------------
create table if not exists public.agency_monthly_goals (
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

create index if not exists idx_agency_monthly_goals_year_month
  on public.agency_monthly_goals (year desc, month desc);

drop trigger if exists trg_agency_monthly_goals_updated_at on public.agency_monthly_goals;
create trigger trg_agency_monthly_goals_updated_at
  before update on public.agency_monthly_goals
  for each row execute function public.set_updated_at();

alter table public.agency_monthly_goals enable row level security;

drop policy if exists "agency_monthly_goals_select_staff" on public.agency_monthly_goals;
create policy "agency_monthly_goals_select_staff"
  on public.agency_monthly_goals for select
  to authenticated
  using (auth_user_role() is not null);

drop policy if exists "agency_monthly_goals_admin_write" on public.agency_monthly_goals;
create policy "agency_monthly_goals_admin_write"
  on public.agency_monthly_goals for insert
  to authenticated
  with check (auth_user_role() = 'admin');

drop policy if exists "agency_monthly_goals_admin_update" on public.agency_monthly_goals;
create policy "agency_monthly_goals_admin_update"
  on public.agency_monthly_goals for update
  to authenticated
  using (auth_user_role() = 'admin')
  with check (auth_user_role() = 'admin');

drop policy if exists "agency_monthly_goals_admin_delete" on public.agency_monthly_goals;
create policy "agency_monthly_goals_admin_delete"
  on public.agency_monthly_goals for delete
  to authenticated
  using (auth_user_role() = 'admin');

comment on table public.agency_monthly_goals is
  'Objectifs mensuels agence (CA, clients, vidéos, tâches) — lecture staff, écriture admin.';

-- ---------------------------------------------------------------------------
-- document_type: roadmap
-- ---------------------------------------------------------------------------
do $enum$
begin
  alter type public.document_type add value 'roadmap';
exception
  when duplicate_object then null;
end
$enum$;

-- ---------------------------------------------------------------------------
-- documents: période (roadmap mensuelle)
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists period_start date;

alter table public.documents
  add column if not exists period_end date;

comment on column public.documents.period_start is 'Début de période couverte (ex. 1er jour du mois pour une roadmap).';
comment on column public.documents.period_end is 'Fin de période couverte (ex. dernier jour du mois).';

create index if not exists idx_documents_client_type on public.documents (client_id, type)
  where client_id is not null;
