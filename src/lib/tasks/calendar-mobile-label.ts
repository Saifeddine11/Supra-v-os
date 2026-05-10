import type { TaskEnriched } from '@/types/database';

/** Short label for month cells on mobile — not the full task title. */
export function getCalendarMobileTaskLabel(
  task: Pick<TaskEnriched, 'client_name' | 'internal_project_id'>,
): string {
  const name = task.client_name?.trim();
  if (name) return name;
  if (task.internal_project_id) return 'Supra v.';
  return 'Interne';
}
