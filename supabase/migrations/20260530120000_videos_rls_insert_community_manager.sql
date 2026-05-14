-- Community managers can create videos in-app (same as server actions) but were missing from INSERT policies.
-- Align videos + video_assignments INSERT with product roles.

drop policy if exists "videos_insert_authorized" on public.videos;
create policy "videos_insert_authorized"
  on public.videos for insert
  to authenticated
  with check (
    public.auth_user_role() in (
      'admin'::public.user_role,
      'project_manager'::public.user_role,
      'editor'::public.user_role,
      'cameraman'::public.user_role,
      'commercial'::public.user_role,
      'community_manager'::public.user_role
    )
  );

drop policy if exists "video_assignments_insert_authorized" on public.video_assignments;
create policy "video_assignments_insert_authorized"
  on public.video_assignments for insert
  to authenticated
  with check (
    public.auth_user_role() in (
      'admin'::public.user_role,
      'project_manager'::public.user_role,
      'editor'::public.user_role,
      'cameraman'::public.user_role,
      'commercial'::public.user_role,
      'community_manager'::public.user_role
    )
    and exists (select 1 from public.videos v where v.id = public.video_assignments.video_id)
  );
