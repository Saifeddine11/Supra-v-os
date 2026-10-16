-- Team members may create official tasks assigned to themselves (status todo).
-- They still cannot create official tasks for others, set done, or hard-delete.

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

    if new.created_by is distinct from auth.uid() then
      raise exception 'created_by doit être l''auteur' using errcode = '42501';
    end if;
    if new.deleted_at is not null or new.deletion_request_status is not null then
      raise exception 'Suppression non autorisée' using errcode = '42501';
    end if;

    if new.status = 'proposed'::public.task_status then
      return new;
    end if;

    if new.status = 'todo'::public.task_status
       and new.assignee_id is not distinct from actor_employee_id then
      return new;
    end if;

    raise exception 'Un employé ne peut créer qu''une tâche pour lui-même' using errcode = '42501';
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
      and public.tasks.created_by = auth.uid()
      and public.auth_user_role() in (
        'editor'::public.user_role,
        'cameraman'::public.user_role,
        'developer'::public.user_role,
        'designer'::public.user_role,
        'seo'::public.user_role,
        'community_manager'::public.user_role
      )
      and (
        public.tasks.status = 'proposed'::public.task_status
        or (
          public.tasks.status = 'todo'::public.task_status
          and public.tasks.assignee_id = public.auth_employee_id()
        )
      )
    )
  );

drop policy if exists "task_assignments_insert_operational" on public.task_assignments;
create policy "task_assignments_insert_operational"
  on public.task_assignments for insert
  to authenticated
  with check (
    public.auth_is_admin_or_pm()
    or exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and public.auth_can_supervise_department(t.department)
    )
    or (
      public.auth_employee_id() is not null
      and public.auth_user_role() is not null
      and public.auth_user_role() not in (
        'finance'::public.user_role,
        'commercial'::public.user_role
      )
      and task_assignments.employee_id = public.auth_employee_id()
      and exists (
        select 1 from public.tasks t
        where t.id = task_assignments.task_id
          and t.created_by = auth.uid()
      )
    )
  );
