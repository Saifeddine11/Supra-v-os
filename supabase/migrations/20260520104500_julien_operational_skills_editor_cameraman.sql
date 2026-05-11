-- Aligne les compétences opérationnelles « Julien » pour assignation Monteur + Caméraman (idempotent).
-- Constats : role = editor ; operational_skills peut ne contenir que {cameraman} sans entrée explicite « editor ».
update employees
set operational_skills = coalesce(
  (
    select array_agg(distinct u order by u)
    from unnest(coalesce(operational_skills, '{}'::user_role[]) || array['editor', 'cameraman']::user_role[])
      as t(u)
  ),
  '{}'::user_role[]
)
where lower(trim(full_name)) = 'julien'
  and is_active = true
  and archived_at is null;
