-- Kanban advancement pings reuse discord_reminder_deliveries.
-- dedupe_key lets one task/video move forward several times in a day
-- without colliding with operational reminder PK (empty key).

alter table public.discord_reminder_deliveries
  add column if not exists dedupe_key text not null default '';

alter table public.discord_reminder_deliveries
  drop constraint if exists discord_reminder_deliveries_pkey;

alter table public.discord_reminder_deliveries
  add constraint discord_reminder_deliveries_pkey
  primary key (entity_type, entity_id, reminder_type, occurrence_date, dedupe_key);

alter table public.discord_reminder_deliveries
  drop constraint if exists discord_reminder_deliveries_reminder_type_check;

alter table public.discord_reminder_deliveries
  add constraint discord_reminder_deliveries_reminder_type_check
  check (
    reminder_type in (
      'task_due_today',
      'task_overdue',
      'waiting_team_validation',
      'shooting_j_minus_1',
      'shooting_day',
      'daily_report_ask',
      'daily_report_missing',
      'kanban_advancement'
    )
  );
