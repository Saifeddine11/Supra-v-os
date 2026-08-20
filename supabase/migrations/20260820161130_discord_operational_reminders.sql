-- Phase 1.1 Discord operational reminder delivery log.
-- Dedupes cron / after() / retries. Does not copy task or video business data.

create table if not exists public.discord_reminder_deliveries (
  entity_type text not null,
  entity_id uuid not null,
  reminder_type text not null,
  occurrence_date date not null,
  created_at timestamptz not null default now(),
  primary key (entity_type, entity_id, reminder_type, occurrence_date),
  constraint discord_reminder_deliveries_entity_type_check
    check (entity_type in ('task', 'video')),
  constraint discord_reminder_deliveries_reminder_type_check
    check (
      reminder_type in (
        'task_due_today',
        'task_overdue',
        'waiting_team_validation',
        'shooting_j_minus_1',
        'shooting_day'
      )
    )
);

comment on table public.discord_reminder_deliveries is
  'Idempotent Discord reminder deliveries keyed by entity, type, and Africa/Casablanca occurrence date.';

create index if not exists discord_reminder_deliveries_occurrence_idx
  on public.discord_reminder_deliveries (occurrence_date, reminder_type);

alter table public.discord_reminder_deliveries enable row level security;

revoke all on public.discord_reminder_deliveries from anon, authenticated;
