-- Client projects: priority for filters and roadmap (aligns with tasks priority enum)
alter table projects
  add column if not exists priority task_priority not null default 'normal';

create index if not exists idx_projects_priority on projects(priority);
