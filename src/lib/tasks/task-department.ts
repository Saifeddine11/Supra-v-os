import type { TaskDepartment } from '@/types/database';

export const TASK_DEPARTMENTS: readonly TaskDepartment[] = [
  'production_video',
  'video_distribution',
  'community_management',
  'media_buying',
  'web_seo',
] as const;

export function isTaskDepartment(value: unknown): value is TaskDepartment {
  return typeof value === 'string' && (TASK_DEPARTMENTS as readonly string[]).includes(value);
}

export function parseTaskDepartmentInput(
  raw: unknown,
): { ok: true; value: TaskDepartment | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const s = String(raw).trim();
  if (!s) return { ok: true, value: null };
  if (!isTaskDepartment(s)) return { ok: false, error: 'Département invalide.' };
  return { ok: true, value: s };
}
