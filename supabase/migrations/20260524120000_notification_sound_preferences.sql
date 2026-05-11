-- Préférences sons in-app (cloche / polling) — sans impact sur les emails cron.
alter table public.user_notification_preferences
  add column if not exists notification_sound_enabled boolean not null default true;

alter table public.user_notification_preferences
  add column if not exists notification_sound_urgent_only boolean not null default false;

alter table public.user_notification_preferences
  add column if not exists notification_sound_volume text not null default 'medium';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'user_notification_preferences'
      and c.conname = 'user_notification_preferences_sound_volume_check'
  ) then
    alter table public.user_notification_preferences
      add constraint user_notification_preferences_sound_volume_check
      check (notification_sound_volume in ('low', 'medium', 'high'));
  end if;
end $$;

comment on column public.user_notification_preferences.notification_sound_enabled is
  'Si false, aucun son in-app pour les nouvelles notifications.';
comment on column public.user_notification_preferences.notification_sound_urgent_only is
  'Si true, seuls les niveaux urgent/critique déclenchent un son.';
comment on column public.user_notification_preferences.notification_sound_volume is
  'Gain relatif des sons : low | medium | high.';
