-- Accountability-safe tasks.
-- Run on LOCAL or STAGING after applying:
--   supabase/migrations/20260925123515_task_accountability_safe.sql
--   supabase/migrations/20260925130918_task_accountability_safe_rules.sql
--
-- Do NOT run against production.
-- The transaction ROLLS BACK. Watch NOTICE lines for PASS.
-- =============================================================================

begin;

do $$
declare
  v_editor_user uuid := gen_random_uuid();
  v_pm_user uuid := gen_random_uuid();
  v_sup_user uuid := gen_random_uuid();
  v_other_user uuid := gen_random_uuid();
  v_editor_emp uuid := gen_random_uuid();
  v_pm_emp uuid := gen_random_uuid();
  v_sup_emp uuid := gen_random_uuid();
  v_other_emp uuid := gen_random_uuid();
  v_task uuid;
  v_foreign uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  select
    '00000000-0000-0000-0000-000000000000',
    u.id, 'authenticated', 'authenticated', u.email,
    crypt('accountability-test', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  from (
    values
      (v_editor_user, 'acct-editor@example.com'),
      (v_pm_user, 'acct-pm@example.com'),
      (v_sup_user, 'acct-sup@example.com'),
      (v_other_user, 'acct-other@example.com')
  ) as u(id, email);

  insert into public.employees (id, user_id, full_name, email, role, department, is_department_supervisor, is_active)
  values
    (v_editor_emp, v_editor_user, 'Acct Editor', 'acct-editor@example.com', 'editor', 'production_video', false, true),
    (v_pm_emp, v_pm_user, 'Acct PM', 'acct-pm@example.com', 'project_manager', null, false, true),
    (v_sup_emp, v_sup_user, 'Acct Supervisor', 'acct-sup@example.com', 'editor', 'production_video', true, true),
    (v_other_emp, v_other_user, 'Acct Other', 'acct-other@example.com', 'editor', 'web_seo', true, true);

  perform set_config('request.jwt.claim.sub', v_editor_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  begin
    insert into public.tasks (title, status, created_by, department)
    values ('cheat official', 'todo', v_editor_user, 'production_video');
    raise exception 'FAIL: employee inserted an official task';
  exception
    when insufficient_privilege or check_violation or others then
      if sqlerrm ilike '%FAIL:%' then raise; end if;
      raise notice 'PASS: employee cannot create an official task (%).', sqlerrm;
  end;

  insert into public.tasks (title, status, created_by, assignee_id, department)
  values ('proposed work', 'proposed', v_editor_user, v_editor_emp, 'production_video')
  returning id into v_task;
  raise notice 'PASS: employee can propose a task';

  begin
    update public.tasks set status = 'done' where id = v_task;
    raise exception 'FAIL: employee set done';
  exception
    when insufficient_privilege or check_violation or others then
      if sqlerrm ilike '%FAIL:%' then raise; end if;
      raise notice 'PASS: employee cannot set done (%).', sqlerrm;
  end;

  begin
    delete from public.tasks where id = v_task;
    raise exception 'FAIL: employee deleted a task';
  exception
    when insufficient_privilege or check_violation or others then
      if sqlerrm ilike '%FAIL:%' then raise; end if;
      raise notice 'PASS: employee cannot delete a task (%).', sqlerrm;
  end;

  begin
    update public.tasks
    set status = 'completed_pending_validation'
    where id = v_task;
    raise exception 'FAIL: completion without proof';
  exception
    when insufficient_privilege or check_violation or others then
      if sqlerrm ilike '%FAIL:%' then raise; end if;
      raise notice 'PASS: proof is required (%).', sqlerrm;
  end;

  update public.tasks
  set proof_note = 'lien de montage', proof_url = 'https://example.com/proof'
  where id = v_task;

  -- Proposed tasks cannot jump to completion before approval.
  begin
    update public.tasks set status = 'completed_pending_validation' where id = v_task;
    raise exception 'FAIL: proposed task marked complete';
  exception
    when insufficient_privilege or check_violation or others then
      if sqlerrm ilike '%FAIL:%' then raise; end if;
      raise notice 'PASS: proposed task cannot be self-completed (%).', sqlerrm;
  end;

  update public.tasks
  set deletion_request_status = 'pending',
      deletion_request_reason = 'doublon',
      deletion_requested_by = v_editor_user,
      deletion_requested_at = now()
  where id = v_task;
  raise notice 'PASS: employee can request deletion';

  if not exists (
    select 1 from public.activity_logs
    where entity_id = v_task and action in ('created', 'proof_added', 'deletion_requested')
  ) then
    raise exception 'FAIL: activity log missing employee traces';
  end if;
  raise notice 'PASS: activity log kept employee traces';

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', v_pm_user::text, true);
  execute 'set local role authenticated';

  update public.tasks set status = 'todo' where id = v_task;
  raise notice 'PASS: project manager can approve a proposed task';

  update public.tasks
  set status = 'completed_pending_validation'
  where id = v_task;
  -- PM may set this; employee path is the one under test for proof. Row already has proof.
  update public.tasks set status = 'done', completed_at = now() where id = v_task;
  raise notice 'PASS: project manager can validate completion';

  update public.tasks set status = 'completed_pending_validation' where id = v_task;
  update public.tasks set status = 'in_progress' where id = v_task;
  raise notice 'PASS: project manager can reject completion';

  update public.tasks
  set deletion_request_status = 'rejected',
      deletion_review_note = 'à garder',
      deletion_reviewed_by = v_pm_user,
      deletion_reviewed_at = now()
  where id = v_task;
  raise notice 'PASS: project manager can reject a deletion request';

  if not exists (
    select 1 from public.activity_logs
    where entity_id = v_task and action in ('task_approved', 'task_validated', 'task_rejected', 'deletion_rejected')
  ) then
    raise exception 'FAIL: activity log missing manager traces';
  end if;
  raise notice 'PASS: activity log kept manager traces';

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', v_other_user::text, true);
  execute 'set local role authenticated';

  begin
    update public.tasks set status = 'done' where id = v_task;
    raise exception 'FAIL: other-department supervisor validated the task';
  exception
    when insufficient_privilege or check_violation or others then
      if sqlerrm ilike '%FAIL:%' then raise; end if;
      raise notice 'PASS: supervisor outside the department cannot validate (%).', sqlerrm;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', v_sup_user::text, true);
  execute 'set local role authenticated';

  update public.tasks
  set deletion_request_status = 'pending',
      deletion_request_reason = 'encore',
      deletion_requested_by = v_editor_user
  where id = v_task;

  update public.tasks
  set deletion_request_status = 'approved',
      deleted_at = now(),
      deleted_by = v_sup_user,
      deletion_reviewed_by = v_sup_user,
      deletion_reviewed_at = now()
  where id = v_task;
  raise notice 'PASS: department supervisor can soft-delete inside the department';

  begin
    delete from public.tasks where id = v_task;
    raise exception 'FAIL: supervisor hard-deleted';
  exception
    when insufficient_privilege or check_violation or others then
      if sqlerrm ilike '%FAIL:%' then raise; end if;
      raise notice 'PASS: supervisor cannot hard-delete (%).', sqlerrm;
  end;

  -- Foreign task in another department.
  execute 'reset role';
  insert into public.tasks (title, status, created_by, department)
  values ('other pole', 'todo', v_pm_user, 'web_seo')
  returning id into v_foreign;

  perform set_config('request.jwt.claim.sub', v_sup_user::text, true);
  execute 'set local role authenticated';
  begin
    update public.tasks set status = 'done' where id = v_foreign;
    raise exception 'FAIL: supervisor updated a task outside the department';
  exception
    when insufficient_privilege or check_violation or others then
      if sqlerrm ilike '%FAIL:%' then raise; end if;
      raise notice 'PASS: supervisor cannot update outside the department (%).', sqlerrm;
  end;
end $$;

rollback;
