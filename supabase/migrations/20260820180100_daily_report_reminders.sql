-- Daily Discord end-of-day report reminders reuse discord_reminder_deliveries.
-- entity_type 'agency' + a fixed entity_id in app code (not a task/video row).

alter table public.discord_reminder_deliveries
  drop constraint if exists discord_reminder_deliveries_entity_type_check;

alter table public.discord_reminder_deliveries
  add constraint discord_reminder_deliveries_entity_type_check
  check (entity_type in ('task', 'video', 'agency'));

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
      'daily_report_missing'
    )
  );
