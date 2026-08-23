-- =============================================================================
-- Phase 0 — client_users / portal_* RPCs / RLS hardening
-- =============================================================================
-- Run on LOCAL or STAGING after applying:
--   supabase/migrations/20260823162513_client_users_portal_rpcs.sql
--
-- Do NOT run against production.
-- Wrapped in a transaction that ROLLS BACK — no leftover Auth users.
-- Watch NOTICE lines: each check should print PASS.
-- =============================================================================

begin;

do $$
declare
  v_client_id uuid;
  v_staff_user_id uuid;
  v_staff_employee_id uuid;
  v_fake_user_id uuid := gen_random_uuid();
  v_n int;
  v_leaks boolean;
  v_cid uuid;
begin
  select c.id into v_client_id
  from public.clients c
  order by c.created_at desc
  limit 1;

  if v_client_id is null then
    raise exception 'FAIL: no client row available';
  end if;

  select e.user_id, e.id
    into v_staff_user_id, v_staff_employee_id
  from public.employees e
  where e.user_id is not null
  order by e.created_at desc
  limit 1;

  if v_staff_user_id is null then
    raise exception 'FAIL: no staff employees.user_id available';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_fake_user_id,
    'authenticated',
    'authenticated',
    'phase0-fake-client@example.com',
    crypt('phase0-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  insert into public.client_users (
    user_id, client_id, full_name, email, is_active, must_change_password
  ) values (
    v_fake_user_id, v_client_id, 'Phase 0 Fake Client',
    'phase0-fake-client@example.com', true, true
  );

  begin
    insert into public.client_users (user_id, client_id, full_name, email)
    values (v_staff_user_id, v_client_id, 'Should Fail', 'should-fail@example.com');
    raise exception 'FAIL: staff user_id was accepted into client_users';
  exception
    when others then
      if sqlerrm like 'client_users cannot reference a staff auth user%' then
        raise notice 'PASS: client_users rejects staff auth users';
      else
        raise;
      end if;
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_fake_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_fake_user_id::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );

  v_cid := public.auth_client_id();
  if v_cid is not distinct from v_client_id then
    raise notice 'PASS: auth_client_id() returns the fake client id';
  else
    raise exception 'FAIL: auth_client_id() = %, expected %', v_cid, v_client_id;
  end if;

  select count(*) into v_n from public.portal_my_client();
  if v_n = 1 then
    raise notice 'PASS: portal_my_client() returns 1 row';
  else
    raise exception 'FAIL: portal_my_client() returned % rows', v_n;
  end if;

  perform * from public.portal_my_projects();
  raise notice 'PASS: portal_my_projects() executes';

  perform * from public.portal_my_videos();
  raise notice 'PASS: portal_my_videos() executes';

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join unnest(coalesce(p.proargnames, array[]::text[])) as arg(name) on true
    where n.nspname = 'public'
      and p.proname = 'portal_my_videos'
      and arg.name in (
        'status',
        'notes_internal',
        'rushes_storage_path',
        'editor_id',
        'cameraman_id',
        'client_feedback',
        'revision_count'
      )
  ) into v_leaks;

  if not v_leaks then
    raise notice 'PASS: portal_my_videos() has no internal columns';
  else
    raise exception 'FAIL: portal_my_videos() exposes an internal column';
  end if;

  select count(*) into v_n from public.employees;
  if v_n = 0 then
    raise notice 'PASS: client cannot read employees';
  else
    raise exception 'FAIL: client read % employees', v_n;
  end if;

  select count(*) into v_n from public.tasks;
  if v_n = 0 then
    raise notice 'PASS: client cannot read tasks';
  else
    raise exception 'FAIL: client read % tasks', v_n;
  end if;

  select count(*) into v_n from public.videos;
  if v_n = 0 then
    raise notice 'PASS: client cannot SELECT videos directly';
  else
    raise exception 'FAIL: client SELECT videos returned % rows', v_n;
  end if;

  select count(*) into v_n from public.projects;
  if v_n = 0 then
    raise notice 'PASS: client cannot SELECT projects directly';
  else
    raise exception 'FAIL: client SELECT projects returned % rows', v_n;
  end if;

  begin
    insert into public.notifications (
      recipient_user_id, type, priority, title
    ) values (
      v_fake_user_id,
      'comment_added',
      'normal',
      'client should not insert'
    );
    raise exception 'FAIL: client inserted a notification';
  exception
    when others then
      if sqlstate = '42501' or sqlerrm ilike '%row-level security%' then
        raise notice 'PASS: client cannot insert notifications';
      else
        raise;
      end if;
  end;

  begin
    insert into public.activity_logs (
      actor_user_id, actor_label, action, entity_type
    ) values (
      v_fake_user_id, 'fake client', 'test', 'client'
    );
    raise exception 'FAIL: client inserted an activity_log';
  exception
    when others then
      if sqlstate = '42501' or sqlerrm ilike '%row-level security%' then
        raise notice 'PASS: client cannot insert activity_logs';
      else
        raise;
      end if;
  end;

  begin
    insert into public.comments (
      entity_type, entity_id, author_id, body
    ) values (
      'task', gen_random_uuid(), v_fake_user_id, 'client should not comment'
    );
    raise exception 'FAIL: client inserted a comment';
  exception
    when others then
      if sqlstate = '42501' or sqlerrm ilike '%row-level security%' then
        raise notice 'PASS: client cannot insert comments';
      else
        raise;
      end if;
  end;

  begin
    insert into public.user_notification_preferences (user_id)
    values (v_fake_user_id);
    raise exception 'FAIL: client inserted notification preferences';
  exception
    when others then
      if sqlstate = '42501' or sqlerrm ilike '%row-level security%' then
        raise notice 'PASS: client cannot insert user_notification_preferences';
      else
        raise;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', v_staff_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_staff_user_id::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );

  if public.auth_employee_id() is not distinct from v_staff_employee_id then
    raise notice 'PASS: staff auth_employee_id() still resolves';
  else
    raise exception 'FAIL: staff auth_employee_id() = %, expected %',
      public.auth_employee_id(), v_staff_employee_id;
  end if;

  if public.auth_client_id() is null then
    raise notice 'PASS: staff auth_client_id() is null';
  else
    raise exception 'FAIL: staff auth_client_id() must be null';
  end if;

  insert into public.activity_logs (
    actor_user_id, actor_label, action, entity_type
  ) values (
    v_staff_user_id, 'phase0 staff test', 'phase0_rls_check', 'system'
  );
  raise notice 'PASS: staff can still insert activity_logs';

  raise notice 'PASS: phase 0 security checks completed (transaction will roll back)';
end;
$$;

rollback;
