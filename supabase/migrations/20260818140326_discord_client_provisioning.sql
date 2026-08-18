-- Persist the Discord category created/linked for a SUPRA client.
-- Additive and nullable: existing clients stay unlinked until a one-time admin link.

alter table public.clients
  add column if not exists discord_category_id text;

alter table public.clients
  drop constraint if exists clients_discord_category_id_snowflake;

alter table public.clients
  add constraint clients_discord_category_id_snowflake
  check (
    discord_category_id is null
    or discord_category_id ~ '^[0-9]{17,20}$'
  );

comment on column public.clients.discord_category_id is
  'Discord guild category snowflake for this client. Identity is this ID, never the category name.';

create unique index if not exists clients_discord_category_id_uidx
  on public.clients (discord_category_id)
  where discord_category_id is not null;
