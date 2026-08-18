-- Task work-stream department (independent of employees.role / operational_skills).
-- Discord channel routing becomes client_id + tasks.department.
-- Additive: nullable tasks.department; existing non-video tasks stay null.
-- Does not backfill from employee roles or skills.

do $$ begin
  create type public.task_department as enum (
    'production_video',
    'video_distribution',
    'community_management',
    'media_buying',
    'web_seo'
  );
exception
  when duplicate_object then null;
end $$;

comment on type public.task_department is
  'Task work stream for Discord channel routing. Independent of employees.role.';

alter table public.tasks
  add column if not exists department public.task_department;

comment on column public.tasks.department is
  'Work-stream department for Discord routing (client_id + department). Null = no department match; never inferred from assignee role.';

create index if not exists idx_tasks_department
  on public.tasks (department)
  where department is not null;

-- Video-production-generated tasks only (tasks.video_id). Not from employee role/skills.
update public.tasks
set department = 'production_video'::public.task_department
where video_id is not null
  and department is null;

-- Replace employee-role routing keys. Role-specific routes cannot map to task_department.
-- Client-default and global fallback rows (department_role null) are kept.
drop index if exists public.discord_channel_routes_client_role_uidx;
drop index if exists public.discord_channel_routes_client_default_uidx;
drop index if exists public.discord_channel_routes_role_default_uidx;
drop index if exists public.discord_channel_routes_global_uidx;

alter table public.discord_channel_routes
  drop constraint if exists discord_channel_routes_not_client_role;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discord_channel_routes'
      and column_name = 'department_role'
  ) then
    delete from public.discord_channel_routes
    where department_role is not null;
    alter table public.discord_channel_routes
      drop column department_role;
  end if;
end $$;

alter table public.discord_channel_routes
  add column if not exists department public.task_department;

comment on table public.discord_channel_routes is
  'Maps client + tasks.department to a Discord channel snowflake. Null client or department = fallback. Not employees.role.';

comment on column public.discord_channel_routes.department is
  'Task department for this route. Null = client default or global fallback.';

create unique index if not exists discord_channel_routes_client_department_uidx
  on public.discord_channel_routes (client_id, department)
  where client_id is not null and department is not null;

create unique index if not exists discord_channel_routes_client_default_uidx
  on public.discord_channel_routes (client_id)
  where client_id is not null and department is null;

create unique index if not exists discord_channel_routes_department_default_uidx
  on public.discord_channel_routes (department)
  where client_id is null and department is not null;

create unique index if not exists discord_channel_routes_global_uidx
  on public.discord_channel_routes ((true))
  where client_id is null and department is null;
