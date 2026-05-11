-- Multi-assignation vidéo : monteurs et cadreurs (table pivot).
-- Les colonnes videos.editor_id / cameraman_id restent en sync « premier assigné » pour compatibilité.

create type video_assignment_role as enum ('editor', 'cameraman');

create table public.video_assignments (
  id uuid primary key default uuid_generate_v4(),
  video_id uuid not null references public.videos (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  assignment_role video_assignment_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id, employee_id, assignment_role)
);

create index idx_video_assignments_video on public.video_assignments (video_id);
create index idx_video_assignments_employee on public.video_assignments (employee_id);
create index idx_video_assignments_role on public.video_assignments (assignment_role);

comment on table public.video_assignments is
  'Assignations multiples par vidéo (monteurs / cadreurs). Les colonnes legacy videos.editor_id / cameraman_id reflètent le premier de chaque rôle.';

-- Backfill depuis les colonnes legacy (deux lignes si même personne)
insert into public.video_assignments (video_id, employee_id, assignment_role)
select v.id, v.editor_id, 'editor'::video_assignment_role
from public.videos v
where v.editor_id is not null
on conflict (video_id, employee_id, assignment_role) do nothing;

insert into public.video_assignments (video_id, employee_id, assignment_role)
select v.id, v.cameraman_id, 'cameraman'::video_assignment_role
from public.videos v
where v.cameraman_id is not null
on conflict (video_id, employee_id, assignment_role) do nothing;

alter table public.video_assignments enable row level security;

-- Lecture : tout employé authentifié (aligné sur videos_select_internal).
create policy "video_assignments_select_internal"
  on public.video_assignments for select
  to authenticated
  using (auth_user_role() is not null);

-- Insertion : mêmes rôles que la création de vidéo.
create policy "video_assignments_insert_authorized"
  on public.video_assignments for insert
  to authenticated
  with check (
    auth_user_role() in ('admin', 'project_manager', 'editor', 'cameraman', 'commercial')
    and exists (select 1 from public.videos v where v.id = video_assignments.video_id)
  );

-- Mise à jour / suppression : admin/PM ou assigné legacy sur la vidéo ou déjà présent dans les assignations.
create policy "video_assignments_update_assigned_or_admin"
  on public.video_assignments for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from public.videos v
      where v.id = video_assignments.video_id
        and (v.editor_id = auth_employee_id() or v.cameraman_id = auth_employee_id())
    )
    or exists (
      select 1
      from public.video_assignments va2
      where va2.video_id = video_assignments.video_id
        and va2.employee_id = auth_employee_id()
    )
  )
  with check (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from public.videos v
      where v.id = video_assignments.video_id
        and (v.editor_id = auth_employee_id() or v.cameraman_id = auth_employee_id())
    )
    or exists (
      select 1
      from public.video_assignments va2
      where va2.video_id = video_assignments.video_id
        and va2.employee_id = auth_employee_id()
    )
  );

create policy "video_assignments_delete_assigned_or_admin"
  on public.video_assignments for delete
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from public.videos v
      where v.id = video_assignments.video_id
        and (v.editor_id = auth_employee_id() or v.cameraman_id = auth_employee_id())
    )
    or exists (
      select 1
      from public.video_assignments va2
      where va2.video_id = video_assignments.video_id
        and va2.employee_id = auth_employee_id()
    )
  );
