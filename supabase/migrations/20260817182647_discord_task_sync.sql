-- Phase 1 Discord sync (SUPRA → Discord). Linkage + routing only.
-- Does not duplicate task title, deadline, status, priority, client, or assignments.

alter table public.employees
  add column if not exists discord_user_id text;

alter table public.employees
  drop constraint if exists employees_discord_user_id_snowflake;

alter table public.employees
  add constraint employees_discord_user_id_snowflake
  check (
    discord_user_id is null
    or discord_user_id ~ '^[0-9]{17,20}$'
  );

comment on column public.employees.discord_user_id is
  'Discord user snowflake for mentions. Null = no Discord mention.';

create table if not exists public.task_discord_messages (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  discord_channel_id text not null,
  discord_message_id text not null,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_discord_messages_channel_snowflake
    check (discord_channel_id ~ '^[0-9]{17,20}$'),
  constraint task_discord_messages_message_snowflake
    check (discord_message_id ~ '^[0-9]{17,20}$')
);

comment on table public.task_discord_messages is
  'Discord message linkage for an existing SUPRA task. Not a second task store.';

create table if not exists public.discord_channel_routes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  department_role public.user_role,
  discord_channel_id text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discord_channel_routes_channel_snowflake
    check (discord_channel_id ~ '^[0-9]{17,20}$'),
  constraint discord_channel_routes_not_client_role
    check (department_role is null or department_role <> 'client'::public.user_role)
);

comment on table public.discord_channel_routes is
  'Maps client + employees.role to a Discord channel snowflake. Null client or role = fallback.';

create unique index if not exists discord_channel_routes_client_role_uidx
  on public.discord_channel_routes (client_id, department_role)
  where client_id is not null and department_role is not null;

create unique index if not exists discord_channel_routes_client_default_uidx
  on public.discord_channel_routes (client_id)
  where client_id is not null and department_role is null;

create unique index if not exists discord_channel_routes_role_default_uidx
  on public.discord_channel_routes (department_role)
  where client_id is null and department_role is not null;

create unique index if not exists discord_channel_routes_global_uidx
  on public.discord_channel_routes ((true))
  where client_id is null and department_role is null;

alter table public.task_discord_messages enable row level security;
alter table public.discord_channel_routes enable row level security;

revoke all on public.task_discord_messages from anon, authenticated;
revoke all on public.discord_channel_routes from anon, authenticated;

-- Service role bypasses RLS. No authenticated policies: staff UI uses the admin client.
