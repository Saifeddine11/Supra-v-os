-- Compétences opérationnelles (assignation terrain) — distinct du champ role (RBAC / permissions).

alter table public.employees
  add column if not exists operational_skills user_role[] not null default '{}';

comment on column public.employees.operational_skills is
  'Compétences pour assignation (montage, tournage, etc.). Le champ role reste le rôle permissionnel principal.';

-- Rétro-remplissage : une compétence = rôle actuel pour les profils opérationnels connus.
update public.employees
set operational_skills = array[role]::user_role[]
where role in (
  'project_manager',
  'editor',
  'cameraman',
  'developer',
  'designer',
  'seo',
  'community_manager',
  'commercial',
  'finance'
);
