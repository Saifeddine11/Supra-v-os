/**
 * Règles uniques pour les alertes actives (live) — distinctes des notifications historiques.
 */
import type { InvoiceStatus, TaskPriority, TaskStatus, VideoPublicStatus, VideoStatus } from '@/types/database';
import { getShootingScheduleState } from '@/lib/deadlines/deadline-state';
import { isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';
import {
  isVideoShootingInProgressStatus,
  videoNeedsShootingConfirmation,
} from '@/lib/videos/shooting-confirmation';

export type ActiveAlertSeverity = 'critical' | 'warning' | 'info';

/** Statuts tâche : plus d’action requise sur le board. */
export const TASK_RESOLVED_STATUSES: readonly TaskStatus[] = ['done', 'archived'];

/**
 * Tâches en pause côté alertes critiques (toujours visibles au board / calendrier).
 * Pas d’alerte « retard » ni « urgent » stressante.
 */
export const TASK_ALERT_PAUSED_STATUSES: readonly TaskStatus[] = ['waiting_client', 'review'];

/** Filtre SQL PostgREST pour requêtes d’alertes tâches internes. */
export const TASK_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL = '(done,archived,waiting_client,review)';

/** Statuts vidéo : production / alerte résolue. */
export const VIDEO_RESOLVED_STATUSES: readonly VideoStatus[] = [
  'validated',
  'published',
  'archived',
  'cancelled',
];

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

export function isTaskResolved(status: TaskStatus | string | null | undefined): boolean {
  if (!status) return true;
  return (TASK_RESOLVED_STATUSES as readonly string[]).includes(status);
}

export function isTaskPausedForAlerts(status: TaskStatus | string | null | undefined): boolean {
  if (!status) return false;
  return (TASK_ALERT_PAUSED_STATUSES as readonly string[]).includes(status);
}

/** Attente client / révision — pas une urgence production interne. */
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

/** Alias — alertes actives critiques (banner, dashboard urgent, crons). */
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

export function isVideoResolved(
  status: VideoStatus | string | null | undefined,
  publicStatus?: VideoPublicStatus | string | null,
): boolean {
  if (!status) return true;
  if ((VIDEO_RESOLVED_STATUSES as readonly string[]).includes(status)) return true;
  const pub = publicStatus ?? null;
  return pub === 'published' || pub === 'validated';
}

export function isVideoActiveForAlerts(video: {
  status: VideoStatus | string | null | undefined;
  public_status?: VideoPublicStatus | string | null;
}): boolean {
  return !isVideoResolved(video.status, video.public_status);
}

export function isVideoInPostProduction(status: VideoStatus | string | null | undefined): boolean {
  if (!status) return false;
  return (VIDEO_POST_SHOOT_STATUSES as readonly string[]).includes(status);
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

/** Tournage calendaire dépassé (hors phase post-prod / confirmée). */
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

/** Fin prévue dépassée alors que le tournage est toujours en cours. */
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

/** Rappel doux : tournage en cours (pas critique). */
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

export function shouldShowVideoDeliveryOverdueAlert(video: {
  status: VideoStatus | string;
  public_status?: VideoPublicStatus | string | null;
  client_delivery_at?: string | null;
  delivery_deadline?: string | null;
}): boolean {
  if (!isVideoActiveForAlerts(video)) return false;
  return isVideoDeliveryOverdue({
    status: video.status,
    public_status: video.public_status ?? 'topic_proposed',
    client_delivery_at: video.client_delivery_at ?? null,
    delivery_deadline: video.delivery_deadline ?? null,
  });
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

/** Tournage confirmation : critique si > 24 h après la date prévue. */
export function shootingConfirmationSeverity(
  shootingDateIso: string,
  now: Date = new Date(),
): ActiveAlertSeverity {
  const sd = new Date(shootingDateIso).getTime();
  if (!Number.isFinite(sd)) return 'warning';
  const hours = (now.getTime() - sd) / 3600_000;
  return hours > 24 ? 'critical' : 'warning';
}
