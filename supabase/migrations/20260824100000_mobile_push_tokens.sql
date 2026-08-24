-- =============================================================================
-- PUSH NOTIFICATIONS MOBILES — table des jetons d'appareil
-- =============================================================================
-- Stocke les ExpoPushToken des appareils du personnel afin d'envoyer une
-- notification native quand une ligne `notifications` est créée pour eux.
--
-- Principe de diffusion (v1) : le push SUIT les destinataires existants.
-- Aucun système de broadcast n'est introduit ici.
--
-- Migration ADDITIVE : aucun DROP TABLE/COLUMN, aucun DELETE/UPDATE de données.
-- Les seuls DROP sont des `drop policy if exists` suivis du CREATE POLICY
-- correspondant (convention du projet, idempotence).
-- =============================================================================

create table if not exists public.mobile_push_tokens (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  /** ExpoPushToken[...] — unique : un jeton ne vit que sur un appareil. */
  expo_push_token  text not null unique,
  platform         text,
  device_name      text,
  is_active        boolean not null default true,
  last_seen_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_mobile_push_tokens_user
  on public.mobile_push_tokens(user_id);
create index if not exists idx_mobile_push_tokens_active
  on public.mobile_push_tokens(user_id) where is_active;

comment on table public.mobile_push_tokens is
  'Jetons Expo des appareils mobiles (staff). Jamais exposés à un autre utilisateur.';

drop trigger if exists trg_mobile_push_tokens_updated_at on public.mobile_push_tokens;
create trigger trg_mobile_push_tokens_updated_at
  before update on public.mobile_push_tokens
  for each row execute function set_updated_at();

-- ─── RLS : chacun ne voit et n'écrit que SES jetons ─────────────────────────
-- L'envoi côté serveur passe par la service_role (bypass RLS).

alter table public.mobile_push_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on public.mobile_push_tokens;
create policy "push_tokens_select_own"
  on public.mobile_push_tokens for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_tokens_insert_own" on public.mobile_push_tokens;
create policy "push_tokens_insert_own"
  on public.mobile_push_tokens for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push_tokens_update_own" on public.mobile_push_tokens;
create policy "push_tokens_update_own"
  on public.mobile_push_tokens for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_tokens_delete_own" on public.mobile_push_tokens;
create policy "push_tokens_delete_own"
  on public.mobile_push_tokens for delete
  to authenticated
  using (user_id = auth.uid());

-- Privilèges table : jamais anon.
revoke all on public.mobile_push_tokens from anon;
grant select, insert, update, delete on public.mobile_push_tokens to authenticated;

-- =============================================================================
-- VÉRIFICATIONS (staging)
-- =============================================================================
--   select to_regclass('public.mobile_push_tokens');        -- attendu : la table
--   select relrowsecurity from pg_class
--     where oid = 'public.mobile_push_tokens'::regclass;    -- attendu : true
--   select policyname, cmd from pg_policies
--     where tablename = 'mobile_push_tokens' order by 1;    -- attendu : 4 policies
--
-- Session utilisateur A : ne doit voir que ses jetons
--   select count(*) from public.mobile_push_tokens;         -- attendu : ses lignes
--   insert into public.mobile_push_tokens(user_id, expo_push_token)
--     values ('<AUTRE_USER>', 'x');                         -- attendu : ERREUR RLS
-- =============================================================================
