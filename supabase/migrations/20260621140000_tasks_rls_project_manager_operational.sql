-- Chef de projet : INSERT / UPDATE / DELETE opérationnels sur tasks + task_assignments.
-- Finance / commercial : exclus de la création et de la gestion des tâches.

drop policy if exists "tasks_insert_authorized" on public.tasks;
drop policy if exists "tasks_insert_operational" on public.tasks;
create policy "tasks_insert_operational"
  on public.tasks for insert
  to authenticated
  with check (
    public.auth_is_admin_or_pm()
    or (
      public.auth_employee_id() is not null
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

drop policy if exists "tasks_delete_admin_pm" on public.tasks;
create policy "tasks_delete_admin_pm"
  on public.tasks for delete
  to authenticated
  using (public.auth_is_admin_or_pm());

drop policy if exists "task_assignments_insert_authorized" on public.task_assignments;
drop policy if exists "task_assignments_insert_operational" on public.task_assignments;
create policy "task_assignments_insert_operational"
  on public.task_assignments for insert
  to authenticated
  with check (
    public.auth_is_admin_or_pm()
    or (
      public.auth_employee_id() is not null
      and public.auth_user_role() is not null
      and public.auth_user_role() not in (
        'finance'::public.user_role,
        'commercial'::public.user_role
      )
      and exists (
        select 1
        from public.tasks t
        where t.id = task_assignments.task_id
      )
    )
  );
