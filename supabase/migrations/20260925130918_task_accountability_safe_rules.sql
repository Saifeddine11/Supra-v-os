-- Uses task_status values committed by 20260925123515_task_accountability_safe.sql.
-- Postgres cannot use a new enum value in the same transaction that adds it.

-- Accountability-safe tasks.
-- Employees may propose work, add proof, request completion, and request deletion.
-- They cannot set status = done and they cannot hard-delete.
-- done stays the validated final status.
-- Not applied to production by this file alone.

alter table public.tasks
  add column if not exists proof_url text,
  add column if not exists proof_note text,
  add column if not exists proof_added_at timestamptz,
  add column if not exists proof_added_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_request_reason text,
  add column if not exists deletion_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_request_status text,
  add column if not exists deletion_reviewed_at timestamptz,
  add column if not exists deletion_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_review_note text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.tasks
  drop constraint if exists tasks_deletion_request_status_check;
alter table public.tasks
  add constraint tasks_deletion_request_status_check
  check (
    deletion_request_status is null
    or deletion_request_status in ('pending', 'approved', 'rejected')
  );

alter table public.tasks
  drop constraint if exists tasks_proof_required_for_completion_request;
alter table public.tasks
  add constraint tasks_proof_required_for_completion_request
  check (
    status <> 'completed_pending_validation'::public.task_status
    or nullif(btrim(coalesce(proof_url, '')), '') is not null
    or nullif(btrim(coalesce(proof_note, '')), '') is not null
  );

create index if not exists idx_tasks_accountability_queue
  on public.tasks (status, deletion_request_status)
  where deleted_at is null
    and (
      status in ('proposed'::public.task_status, 'completed_pending_validation'::public.task_status)
      or deletion_request_status = 'pending'
    );

-- ---------------------------------------------------------------------------
-- Trigger: employees cannot bypass the UI.
-- service_role is the existing server path for admin / project_manager only.
-- ---------------------------------------------------------------------------

create or replace function public.tasks_enforce_accountability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
  actor_role public.user_role;
  actor_employee_id uuid;
  supervises boolean;
  owns boolean;
  proof_now boolean;
  proof_before boolean;
begin
  jwt_role := coalesce(auth.jwt() ->> 'role', '');
  if jwt_role = 'service_role' or auth.role() = 'service_role' then
    return new;
  end if;

  select e.role, e.id
    into actor_role, actor_employee_id
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;

  if actor_role is null or actor_employee_id is null then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;

  if actor_role in (
    'client'::public.user_role,
    'finance'::public.user_role,
    'commercial'::public.user_role
  ) then
    raise exception 'Action non autorisée pour ce rôle' using errcode = '42501';
  end if;

  if actor_role in ('admin'::public.user_role, 'project_manager'::public.user_role) then
    return new;
  end if;

  supervises :=
    public.auth_is_department_supervisor()
    and new.department is not null
    and new.department = public.auth_employee_department();

  if tg_op = 'INSERT' then
    if supervises then
      if new.deleted_at is not null then
        raise exception 'La suppression directe n''est pas autorisée' using errcode = '42501';
      end if;
      return new;
    end if;

    if new.status is distinct from 'proposed'::public.task_status then
      raise exception 'Un employé ne peut créer qu''une tâche proposée' using errcode = '42501';
    end if;
    if new.created_by is distinct from auth.uid() then
      raise exception 'created_by doit être l''auteur' using errcode = '42501';
    end if;
    if new.deleted_at is not null or new.deletion_request_status is not null then
      raise exception 'Suppression non autorisée' using errcode = '42501';
    end if;
    return new;
  end if;

  if supervises then
    if new.status = 'done'::public.task_status and old.status is distinct from 'done'::public.task_status then
      if old.status is distinct from 'completed_pending_validation'::public.task_status
         and old.status is distinct from 'proposed'::public.task_status then
        null;
      end if;
    end if;
    return new;
  end if;

  owns :=
    old.assignee_id = actor_employee_id
    or old.created_by = auth.uid()
    or exists (
      select 1
      from public.task_assignments ta
      where ta.task_id = old.id
        and ta.employee_id = actor_employee_id
    );

  if not owns then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;

  if new.status in ('done'::public.task_status, 'archived'::public.task_status) then
    raise exception 'Un employé ne peut pas valider définitivement une tâche' using errcode = '42501';
  end if;

  if new.deleted_at is not null or new.deleted_by is not null then
    raise exception 'Suppression non autorisée' using errcode = '42501';
  end if;

  if new.deletion_reviewed_at is distinct from old.deletion_reviewed_at
     or new.deletion_reviewed_by is distinct from old.deletion_reviewed_by
     or new.deletion_review_note is distinct from old.deletion_review_note
     or new.deletion_request_status in ('approved', 'rejected')
        and old.deletion_request_status is distinct from new.deletion_request_status then
    raise exception 'Décision de suppression réservée à un responsable' using errcode = '42501';
  end if;

  if old.status = 'proposed'::public.task_status
     and new.status is distinct from 'proposed'::public.task_status then
    raise exception 'Une tâche proposée doit être approuvée par un responsable' using errcode = '42501';
  end if;

  if old.status = 'completed_pending_validation'::public.task_status
     and new.status is distinct from 'completed_pending_validation'::public.task_status then
    raise exception 'La validation finale est réservée à un responsable' using errcode = '42501';
  end if;

  if new.status = 'completed_pending_validation'::public.task_status
     and old.status = 'proposed'::public.task_status then
    raise exception 'La tâche doit d''abord être approuvée' using errcode = '42501';
  end if;

  proof_now :=
    nullif(btrim(coalesce(new.proof_url, '')), '') is not null
    or nullif(btrim(coalesce(new.proof_note, '')), '') is not null;
  proof_before :=
    nullif(btrim(coalesce(old.proof_url, '')), '') is not null
    or nullif(btrim(coalesce(old.proof_note, '')), '') is not null;

  if new.status = 'completed_pending_validation'::public.task_status and not proof_now then
    raise exception 'Une preuve est requise avant de marquer la tâche terminée' using errcode = '42501';
  end if;

  if old.status = 'completed_pending_validation'::public.task_status and proof_before and not proof_now then
    raise exception 'La preuve ne peut pas être retirée' using errcode = '42501';
  end if;

  if new.proof_url is distinct from old.proof_url or new.proof_note is distinct from old.proof_note then
    new.proof_added_at := now();
    new.proof_added_by := auth.uid();
  end if;

  if new.deletion_request_status is distinct from old.deletion_request_status then
    if new.deletion_request_status = 'pending'
       and old.deletion_request_status is null
       and nullif(btrim(coalesce(new.deletion_request_reason, '')), '') is not null
       and new.deletion_requested_by = auth.uid() then
      if new.deletion_requested_at is null then
        new.deletion_requested_at := now();
      end if;
    else
      raise exception 'Demande de suppression non autorisée' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tasks_enforce_accountability on public.tasks;
create trigger trg_tasks_enforce_accountability
  before insert or update on public.tasks
  for each row
  execute function public.tasks_enforce_accountability();

revoke all on function public.tasks_enforce_accountability() from public;
revoke all on function public.tasks_enforce_accountability() from anon;
revoke all on function public.tasks_enforce_accountability() from authenticated;

-- Insert: operational employees can only insert status = proposed.
drop policy if exists "tasks_insert_operational" on public.tasks;
create policy "tasks_insert_operational"
  on public.tasks for insert
  to authenticated
  with check (
    public.auth_is_admin_or_pm()
    or (
      public.auth_is_department_supervisor()
      and public.tasks.department is not null
      and public.tasks.department = public.auth_employee_department()
    )
    or (
      public.auth_employee_id() is not null
      and public.tasks.status = 'proposed'::public.task_status
      and public.tasks.created_by = auth.uid()
      and public.auth_user_role() in (
        'editor'::public.user_role,
        'cameraman'::public.user_role,
        'developer'::public.user_role,
        'designer'::public.user_role,
        'seo'::public.user_role,
        'community_manager'::public.user_role
      )
    )
  );

-- Hard delete stays admin + project manager. Supervisors soft-delete via UPDATE.
drop policy if exists "tasks_delete_admin_pm" on public.tasks;
create policy "tasks_delete_admin_pm"
  on public.tasks for delete
  to authenticated
  using (public.auth_is_admin_or_pm());

-- Trace and notify even when the write bypasses the UI (mobile / direct PostgREST).
create or replace function public.tasks_log_accountability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_label text;
  action_name text := null;
  detail text := null;
  notify_managers boolean := false;
  notify_employee uuid := null;
  notice_title text := null;
  notice_message text := null;
begin
  select e.full_name into actor_label
  from public.employees e
  where e.user_id = actor
  limit 1;

  if tg_op = 'INSERT' then
    action_name := 'created';
    if new.status = 'proposed'::public.task_status then
      notify_managers := true;
      notice_title := 'Tâche proposée';
      notice_message := new.title;
    end if;
  elsif new.status is distinct from old.status then
    action_name := 'status_updated';
    detail := old.status::text || ' -> ' || new.status::text;
    if new.status = 'completed_pending_validation'::public.task_status then
      notify_managers := true;
      notice_title := 'Tâche à valider';
      notice_message := new.title;
    elsif old.status = 'proposed'::public.task_status and new.status = 'todo'::public.task_status then
      action_name := 'task_approved';
      notify_employee := new.created_by;
      notice_title := 'Tâche approuvée';
      notice_message := new.title;
    elsif old.status = 'proposed'::public.task_status and new.status = 'archived'::public.task_status then
      action_name := 'task_rejected';
      notify_employee := new.created_by;
      notice_title := 'Tâche refusée';
      notice_message := new.title;
    elsif old.status = 'completed_pending_validation'::public.task_status
          and new.status = 'done'::public.task_status then
      action_name := 'task_validated';
      notify_employee := coalesce(new.proof_added_by, new.created_by);
      notice_title := 'Tâche validée';
      notice_message := new.title;
    elsif old.status = 'completed_pending_validation'::public.task_status
          and new.status is distinct from 'done'::public.task_status then
      action_name := 'task_rejected';
      notify_employee := coalesce(new.proof_added_by, new.created_by);
      notice_title := 'Validation refusée';
      notice_message := new.title;
    end if;
  end if;

  if tg_op = 'UPDATE' and (
    new.proof_url is distinct from old.proof_url
    or new.proof_note is distinct from old.proof_note
  ) then
    insert into public.activity_logs (actor_user_id, actor_label, action, entity_type, entity_id, metadata)
    values (
      actor,
      actor_label,
      'proof_added',
      'task',
      new.id,
      jsonb_build_object('title', new.title)
    );
  end if;

  if tg_op = 'UPDATE' and new.deletion_request_status is distinct from old.deletion_request_status then
    if new.deletion_request_status = 'pending' then
      action_name := 'deletion_requested';
      notify_managers := true;
      notice_title := 'Demande de suppression';
      notice_message := coalesce(new.deletion_request_reason, new.title);
    elsif new.deletion_request_status = 'approved' then
      action_name := 'deletion_approved';
      notify_employee := new.deletion_requested_by;
      notice_title := 'Suppression approuvée';
      notice_message := new.title;
    elsif new.deletion_request_status = 'rejected' then
      action_name := 'deletion_rejected';
      notify_employee := new.deletion_requested_by;
      notice_title := 'Suppression refusée';
      notice_message := coalesce(new.deletion_review_note, new.title);
    end if;
  end if;

  if action_name is not null then
    insert into public.activity_logs (actor_user_id, actor_label, action, entity_type, entity_id, metadata)
    values (
      actor,
      actor_label,
      action_name,
      'task',
      new.id,
      jsonb_build_object(
        'title', new.title,
        'status', new.status,
        'detail', detail,
        'reason', coalesce(new.deletion_review_note, new.deletion_request_reason)
      )
    );
  end if;

  if notify_managers and notice_title is not null then
    insert into public.notifications (
      recipient_user_id, type, priority, title, message, related_entity_type, related_entity_id, link_url
    )
    select e.user_id, 'system'::public.notification_type, 'normal'::public.notification_priority,
           notice_title, notice_message, 'task', new.id, '/tasks'
    from public.employees e
    where e.user_id is not null
      and e.is_active = true
      and e.user_id is distinct from actor
      and (
        e.role = 'project_manager'::public.user_role
        or e.role = 'admin'::public.user_role
        or (
          new.department is not null
          and e.department = new.department
          and (e.is_department_supervisor or e.role = 'department_supervisor'::public.user_role)
        )
      );
  end if;

  if notify_employee is not null and notice_title is not null and notify_employee is distinct from actor then
    insert into public.notifications (
      recipient_user_id, type, priority, title, message, related_entity_type, related_entity_id, link_url
    )
    values (
      notify_employee,
      'system'::public.notification_type,
      'normal'::public.notification_priority,
      notice_title,
      notice_message,
      'task',
      new.id,
      '/tasks'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tasks_log_accountability on public.tasks;
create trigger trg_tasks_log_accountability
  after insert or update on public.tasks
  for each row
  execute function public.tasks_log_accountability();

revoke all on function public.tasks_log_accountability() from public;
revoke all on function public.tasks_log_accountability() from anon;
revoke all on function public.tasks_log_accountability() from authenticated;
