/**
 * Task display metadata — labels/colors copied from the web app
 * (src/types/domain.ts TASK_STATUS_MAP / PRIORITY_MAP) for visual consistency.
 */
import type { TaskPriority, TaskStatus } from '@/types/db';

export interface BadgeConfig {
  label: string;
  color: string;
}

export const TASK_STATUS_MAP: Record<TaskStatus, BadgeConfig> = {
  todo: { label: 'À faire', color: '#9CA3AF' },
  in_progress: { label: 'En cours', color: '#FF450F' },
  waiting_client: { label: 'Attente client', color: '#C4789B' },
  // Legacy enum value — migrated to `blocked`; kept for badges on old rows.
  waiting_team: { label: 'Bloqué', color: '#E05252' },
  review: { label: 'En révision', color: '#E07B3A' },
  blocked: { label: 'Bloqué', color: '#E05252' },
  done: { label: 'Terminé', color: '#3DBD7D' },
  archived: { label: 'Archivé', color: '#525252' },
};

export const PRIORITY_MAP: Record<TaskPriority, BadgeConfig> = {
  low: { label: 'Basse', color: '#525252' },
  normal: { label: 'Normale', color: '#7C8DB0' },
  high: { label: 'Haute', color: '#E07B3A' },
  urgent: { label: 'Urgent', color: '#E05252' },
};

const MONTHS_FR = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/** "17 août" / "17 août 2025" (year shown only if different from current). */
export function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const base = `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function formatDateTime(iso: string | null): string | null {
  const date = formatDeadline(iso);
  if (!date || !iso) return null;
  const d = new Date(iso);
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (!hasTime) return date;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${date} · ${h}:${m}`;
}

const CLOSED_STATUSES: TaskStatus[] = ['done', 'archived'];

export function isTaskOverdue(deadline: string | null, status: TaskStatus): boolean {
  if (!deadline || CLOSED_STATUSES.includes(status)) return false;
  const d = new Date(deadline);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}
