-- Phase 2 RLS : permissions vidéo alignées sur video_assignments (pivot principal).
-- Fallback legacy videos.editor_id / videos.cameraman_id conservé pour données non backfillées.
-- Portail client : inchangé (pas de policies authenticated sur données client sensibles ici).

-- ─── VIDEOS : mise à jour par tout assigné pivot ou legacy, ou admin/PM ─────

drop policy if exists "videos_update_assigned_or_admin" on public.videos;

create policy "videos_update_assigned_or_admin"
  on public.videos for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from public.video_assignments va
      where va.video_id = videos.id
        and va.employee_id = auth_employee_id()
    )
    or editor_id = auth_employee_id()
    or cameraman_id = auth_employee_id()
  )
  with check (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from public.video_assignments va
      where va.video_id = videos.id
        and va.employee_id = auth_employee_id()
    )
    or editor_id = auth_employee_id()
    or cameraman_id = auth_employee_id()
  );

-- ─── VIDEO_ASSIGNMENTS : même logique, pivot listé en premier (lisibilité) ─

drop policy if exists "video_assignments_update_assigned_or_admin" on public.video_assignments;

create policy "video_assignments_update_assigned_or_admin"
  on public.video_assignments for update
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from public.video_assignments va_peer
      where va_peer.video_id = video_assignments.video_id
        and va_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from public.videos v
      where v.id = video_assignments.video_id
        and (v.editor_id = auth_employee_id() or v.cameraman_id = auth_employee_id())
    )
  )
  with check (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from public.video_assignments va_peer
      where va_peer.video_id = video_assignments.video_id
        and va_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from public.videos v
      where v.id = video_assignments.video_id
        and (v.editor_id = auth_employee_id() or v.cameraman_id = auth_employee_id())
    )
  );

drop policy if exists "video_assignments_delete_assigned_or_admin" on public.video_assignments;

create policy "video_assignments_delete_assigned_or_admin"
  on public.video_assignments for delete
  to authenticated
  using (
    auth_is_admin_or_pm()
    or exists (
      select 1
      from public.video_assignments va_peer
      where va_peer.video_id = video_assignments.video_id
        and va_peer.employee_id = auth_employee_id()
    )
    or exists (
      select 1
      from public.videos v
      where v.id = video_assignments.video_id
        and (v.editor_id = auth_employee_id() or v.cameraman_id = auth_employee_id())
    )
  );
