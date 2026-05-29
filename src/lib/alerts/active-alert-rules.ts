/**
 * Règles uniques pour les alertes actives (live) — distinctes des notifications historiques.
 */
import type { InvoiceStatus, TaskPriority, TaskStatus, VideoPublicStatus, VideoStatus } from '@/types/database';
import { getShootingScheduleState } from '@/lib/deadlines/deadline-state';
import {
  isVideoActiveForAlerts,
  isVideoActiveForCriticalAlerts,
  isVideoDeliveryOverdueActive,
  isVideoResolved,
  normalizeVideoStatusForAlerts,
  VIDEO_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL,
  VIDEO_RESOLVED_STATUSES,
} from '@/lib/alerts/video-alert-rules';
import {
  isVideoShootingInProgressStatus,
  videoNeedsShootingConfirmation,
} from '@/lib/videos/shooting-confirmation';

export type ActiveAlertSeverity = 'critical' | 'warning' | 'info';

export type ActiveAlertCategory = 'action_required' | 'follow_up' | 'waiting_external';

export {
  isVideoActiveForAlerts,
  isVideoActiveForCriticalAlerts,
  isVideoDeliveryOverdueActive,
  isVideoResolved,
  normalizeVideoStatusForAlerts,
  VIDEO_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL,
  VIDEO_RESOLVED_STATUSES,
};

/** Alias legacy / libellés alternatifs → statuts canoniques du projet. */
const TASK_STATUS_ALIASES: Record<string, TaskStatus | 'cancelled'> = {
  completed: 'done',
  cancelled: 'archived',
  canceled: 'archived',
  in_review: 'review',
  client_review: 'review',
  en_revision: 'review',
  attente_client: 'waiting_client',
};

export function normalizeTaskStatusForAlerts(status: TaskStatus | string | null | undefined): string | null {
  if (!status) return null;
  const key = String(status).trim().toLowerCase();
  const aliased = TASK_STATUS_ALIASES[key];
  return aliased ?? key;
}

/** Statuts tâche : plus d’action requise sur le board. */
export const TASK_RESOLVED_STATUSES: readonly TaskStatus[] = ['done', 'archived'];

/** Tâches en pause — pas d’alerte stressante. */
export const TASK_ALERT_PAUSED_STATUSES: readonly TaskStatus[] = ['waiting_client', 'review'];

/** Filtre SQL PostgREST pour requêtes d’alertes tâches internes. */
export const TASK_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL = '(done,archived,waiting_client,review)';

/** Digest / suivi client — jamais dans « actions à traiter ». */
export const NON_STRESSFUL_ALERT_IDS: readonly string[] = ['task-wait-client-digest'];

export function isTaskResolved(status: TaskStatus | string | null | undefined): boolean {
  const normalized = normalizeTaskStatusForAlerts(status);
  if (!normalized) return true;
  if (normalized === 'cancelled') return true;
  return (TASK_RESOLVED_STATUSES as readonly string[]).includes(normalized);
}

export function isTaskPausedForAlerts(status: TaskStatus | string | null | undefined): boolean {
  const normalized = normalizeTaskStatusForAlerts(status);
  if (!normalized) return false;
  return (TASK_ALERT_PAUSED_STATUSES as readonly string[]).includes(normalized as TaskStatus);
}

export function isTaskBlockedByExternalReview(status: TaskStatus | string | null | undefined): boolean {
  return isTaskPausedForAlerts(status);
}

export function isTaskActiveForCriticalAlerts(task: {
  status: TaskStatus | string | null | undefined;
  deadline?: string | null;
}): boolean {
  if (isTaskResolved(task.status)) return false;
  if (isTaskPausedForAlerts(task.status)) return false;
  return true;
}

export function isTaskActiveForAlerts(task: {
  status: TaskStatus | string | null | undefined;
  deadline?: string | null;
}): boolean {
  return isTaskActiveForCriticalAlerts(task);
}

export function isTaskOverdueForAlert(task: {
  status: TaskStatus | string | null | undefined;
  deadline?: string | null;
  now?: Date;
}): boolean {
  if (!isTaskActiveForCriticalAlerts(task)) return false;
  if (!task.deadline) return false;
  const now = task.now ?? new Date();
  return new Date(task.deadline).getTime() < now.getTime();
}

export function isTaskUrgentForAlert(task: {
  status: TaskStatus | string | null | undefined;
  priority?: TaskPriority | string | null;
}): boolean {
  if (!isTaskActiveForCriticalAlerts(task)) return false;
  return task.priority === 'urgent' || task.priority === 'high';
}

export function isTaskDueTodayForAlert(task: {
  status: TaskStatus | string | null | undefined;
  deadline?: string | null;
  now?: Date;
}): boolean {
  if (!isTaskActiveForCriticalAlerts(task)) return false;
  if (!task.deadline) return false;
  const now = task.now ?? new Date();
  const dl = new Date(task.deadline);
  if (Number.isNaN(dl.getTime())) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  const t = dl.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export const VIDEO_POST_SHOOT_STATUSES: readonly VideoStatus[] = [
  'shooting_done',
  'rushes_received',
  'editing',
  'internal_review',
  'sent_to_client',
  'client_revision',
  'validated',
  'published',
];

export function isVideoInPostProduction(status: VideoStatus | string | null | undefined): boolean {
  if (!status) return false;
  return (VIDEO_POST_SHOOT_STATUSES as readonly string[]).includes(status);
}

export function isVideoShootingConfirmationActive(
  video: {
    id?: string;
    title?: string;
    status: VideoStatus | string;
    shooting_date?: string | null;
    shooting_completed_at?: string | null;
  },
  now: Date = new Date(),
): boolean {
  return shouldShowShootingConfirmationAlert(video, now);
}

export function shouldShowShootingConfirmationAlert(
  video: {
    id?: string;
    title?: string;
    status: VideoStatus | string;
    shooting_date?: string | null;
    shooting_completed_at?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (!isVideoActiveForAlerts(video)) return false;
  if (video.shooting_completed_at) return false;
  if (isVideoShootingInProgressStatus(video.status)) return false;
  if (isVideoInPostProduction(video.status)) return false;
  return videoNeedsShootingConfirmation(
    {
      id: video.id ?? '',
      title: video.title ?? '',
      status: video.status as VideoStatus,
      shooting_date: video.shooting_date ?? null,
      shooting_completed_at: video.shooting_completed_at ?? null,
    },
    now,
  );
}

export function shouldShowShootingScheduleOverdueAlert(
  video: {
    status: VideoStatus | string;
    shooting_date?: string | null;
    shooting_completed_at?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (!isVideoActiveForAlerts(video)) return false;
  if (video.shooting_completed_at) return false;
  if (isVideoShootingInProgressStatus(video.status)) return false;
  if (isVideoInPostProduction(video.status)) return false;
  if (!video.shooting_date) return false;
  const { state } = getShootingScheduleState(video.shooting_date, video.status as VideoStatus, now);
  return state === 'overdue';
}

export function shouldShowShootingExpectedEndOverdueAlert(
  video: {
    status: VideoStatus | string;
    shooting_completed_at?: string | null;
    shooting_expected_end_at?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (!isVideoActiveForAlerts(video)) return false;
  if (!isVideoShootingInProgressStatus(video.status)) return false;
  if (video.shooting_completed_at) return false;
  if (!video.shooting_expected_end_at) return false;
  const end = new Date(video.shooting_expected_end_at).getTime();
  return Number.isFinite(end) && end < now.getTime();
}

export function shouldShowShootingInProgressInfoAlert(
  video: {
    status: VideoStatus | string;
    shooting_completed_at?: string | null;
    shooting_expected_end_at?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (!isVideoActiveForAlerts(video)) return false;
  if (!isVideoShootingInProgressStatus(video.status)) return false;
  if (video.shooting_completed_at) return false;
  if (shouldShowShootingExpectedEndOverdueAlert(video, now)) return false;
  return true;
}

export function shouldShowVideoDeliveryOverdueAlert(
  video: {
    status: VideoStatus | string;
    public_status?: VideoPublicStatus | string | null;
    client_delivery_at?: string | null;
    delivery_deadline?: string | null;
  },
  now: Date = new Date(),
): boolean {
  return isVideoDeliveryOverdueActive(video, now);
}

export function shouldShowClientValidationAlert(video: {
  status: VideoStatus | string;
  public_status?: VideoPublicStatus | string | null;
}): boolean {
  if (!isVideoActiveForAlerts(video)) return false;
  if (isVideoResolved(video.status, video.public_status)) return false;
  return video.status === 'sent_to_client' || video.public_status === 'in_validation';
}

export function isInvoiceResolved(status: InvoiceStatus | string | null | undefined): boolean {
  return status === 'paid' || status === 'cancelled' || status === 'draft';
}

export function isInvoiceOverdueForAlert(invoice: {
  status: InvoiceStatus | string;
  due_date?: string | null;
}): boolean {
  if (isInvoiceResolved(invoice.status)) return false;
  if (invoice.status === 'overdue') return true;
  if (invoice.status === 'sent' || invoice.status === 'pending') {
    if (!invoice.due_date) return false;
    const today = new Date().toISOString().slice(0, 10);
    return invoice.due_date < today;
  }
  return false;
}

export function shootingConfirmationSeverity(
  shootingDateIso: string,
  now: Date = new Date(),
): ActiveAlertSeverity {
  const sd = new Date(shootingDateIso).getTime();
  if (!Number.isFinite(sd)) return 'warning';
  const hours = (now.getTime() - sd) / 3600_000;
  return hours > 24 ? 'critical' : 'warning';
}

/** Catégorie métier d’une alerte live. */
export function classifyCriticalAlertItem(item: {
  id: string;
  severity: ActiveAlertSeverity;
}): ActiveAlertCategory {
  if ((NON_STRESSFUL_ALERT_IDS as readonly string[]).includes(item.id)) return 'waiting_external';
  if (item.id.startsWith('val-')) return 'waiting_external';

  if (item.id.startsWith('task-od-')) return 'action_required';
  if (item.id.startsWith('vid-od-')) return 'action_required';
  if (item.id.startsWith('vid-shoot-od-')) return 'action_required';
  if (item.id.startsWith('vid-shoot-end-od-')) return 'action_required';
  if (item.id === 'fin-inv-overdue') return 'action_required';
  if (item.id.startsWith('vid-shoot-conf-') && item.severity === 'critical') return 'action_required';

  return 'follow_up';
}

/** Bannière / son / compteur « actions à traiter » — problèmes opérationnels réels uniquement. */
export function isActionRequiredNowAlertItem(item: {
  id: string;
  severity: ActiveAlertSeverity;
}): boolean {
  return classifyCriticalAlertItem(item) === 'action_required';
}

/** @deprecated Utiliser isActionRequiredNowAlertItem */
export function isStressfulCriticalAlertItem(item: {
  id: string;
  severity: ActiveAlertSeverity;
}): boolean {
  return isActionRequiredNowAlertItem(item);
}
