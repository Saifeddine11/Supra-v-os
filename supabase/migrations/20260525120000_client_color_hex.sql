-- Couleur d’identification client (UI interne + portail léger).
alter table public.clients
  add column if not exists color_hex text;

alter table public.clients
  add column if not exists color_label text;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'clients'
      and c.conname = 'clients_color_hex_format_check'
  ) then
    alter table public.clients
      add constraint clients_color_hex_format_check
      check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

comment on column public.clients.color_hex is 'Couleur marque client (#RRGGBB) — pastilles et accents UI.';
comment on column public.clients.color_label is 'Libellé optionnel (ex. « Bleu immobilier ») pour l’équipe.';
