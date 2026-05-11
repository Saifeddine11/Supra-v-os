-- Multi-assignation tâches + index unique tâche production par vidéo.
-- Legacy tasks.assignee_id conservé (premier assigné).

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, employee_id)
);

create index idx_task_assignments_task on public.task_assignments (task_id);
create index idx_task_assignments_employee on public.task_assignments (employee_id);

comment on table public.task_assignments is
  'Assignations multiples par tâche. tasks.assignee_id = premier assigné (compat).';

insert into public.task_assignments (task_id, employee_id)
select t.id, t.assignee_id
from public.tasks t
where t.assignee_id is not null
on conflict (task_id, employee_id) do nothing;

-- Une seule tâche « production » liée à une vidéo donnée.
create unique index if not exists tasks_one_production_task_per_video
  on public.tasks (video_id)
  where video_id is not null;

-- Suppression vidéo : supprimer la tâche de production liée.
alter table public.tasks drop constraint if exists fk_tasks_video;

alter table public.tasks
  add constraint fk_tasks_video
  foreign key (video_id) references public.videos (id) on delete cascade;

alter table public.task_assignments enable row level security;

-- RLS task_assignments (aligné logique video_assignments / tasks).

drop policy if exists "task_assignments_select_internal" on public.task_assignments;
create policy "task_assignments_select_internal"
  on public.task_assignments for select
  to authenticated
  using (auth_user_role() is not null);

drop policy if exists "task_assignments_insert_authorized" on public.task_assignments;
create policy "task_assignments_insert_authorized"
  on public.task_assignments for insert
  to authenticated
  with check (
    auth_user_role() is not null
    and exists (select 1 from public.tasks t where t.id = task_assignments.task_id)
  );

drop policy if exists "task_assignments_update_assigned_or_admin" on public.task_assignments;
create policy "task_assignments_update_assigned_or_admin"
  on public.task_assignments for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from public.task_assignments ta_peer
      where ta_peer.task_id = task_assignments.task_id
        and ta_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from public.tasks t
      where t.id = task_assignments.task_id
        and t.assignee_id = auth_employee_id()
    )
  )
  with check (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from public.task_assignments ta_peer
      where ta_peer.task_id = task_assignments.task_id
        and ta_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from public.tasks t
      where t.id = task_assignments.task_id
        and t.assignee_id = auth_employee_id()
    )
  );

drop policy if exists "task_assignments_delete_assigned_or_admin" on public.task_assignments;
create policy "task_assignments_delete_assigned_or_admin"
  on public.task_assignments for delete
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from public.task_assignments ta_peer
      where ta_peer.task_id = task_assignments.task_id
        and ta_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from public.tasks t
      where t.id = task_assignments.task_id
        and t.assignee_id = auth_employee_id()
    )
  );

-- Tâches : mise à jour par tout assigné pivot ou legacy / watchers / admin-PM.

drop policy if exists "tasks_update_assigned_or_admin" on public.tasks;

create policy "tasks_update_assigned_or_admin"
  on public.tasks for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or assignee_id = auth_employee_id()
    or auth_employee_id() = any (watcher_ids)
    or exists (
      select 1
      from public.task_assignments ta
      where ta.task_id = tasks.id
        and ta.employee_id = auth_employee_id()
    )
  )
  with check (
    auth_is_admin_or_pm()
    or assignee_id = auth_employee_id()
    or auth_employee_id() = any (watcher_ids)
    or exists (
      select 1
      from public.task_assignments ta
      where ta.task_id = tasks.id
        and ta.employee_id = auth_employee_id()
    )
  );
