import type { Notification, NotificationPriority, NotificationType } from '@/types/database';

export type NotificationSoundLevel = 'silent' | 'soft' | 'important' | 'urgent' | 'critical';

const CRITICAL_TYPES = new Set<NotificationType>([
  'task_overdue',
  'invoice_overdue',
  'critical_alert_reminder',
]);

const URGENT_TYPES = new Set<NotificationType>([
  'task_deadline_approaching',
  'deadline_soon',
  'invoice_due_soon',
  'quote_expiring',
  'client_revision_requested',
  'report_due',
]);

const SOFT_TYPES = new Set<NotificationType>([
  'document_uploaded',
  'system',
  'quota_incomplete',
  'employee_overloaded',
  'employee_task_not_updated',
  'invoice_paid',
  'quote_converted',
  'morning_summary',
  'evening_summary',
]);

/**
 * Niveau sonore cible pour une notification in-app (non lue).
 * Ne pas utiliser pour les notifications déjà lues.
 */
export function getNotificationSoundLevel(n: Pick<Notification, 'type' | 'priority' | 'is_read'>): NotificationSoundLevel {
  if (n.is_read) return 'silent';

  if (CRITICAL_TYPES.has(n.type)) return 'critical';

  if (n.priority === 'urgent') return 'urgent';

  if (URGENT_TYPES.has(n.type)) return 'urgent';

  if (SOFT_TYPES.has(n.type)) return 'soft';

  if (n.priority === 'high') return 'important';

  return 'important';
}

export function soundLevelRank(level: NotificationSoundLevel): number {
  switch (level) {
    case 'silent':
      return 0;
    case 'soft':
      return 1;
    case 'important':
      return 2;
    case 'urgent':
      return 3;
    case 'critical':
      return 4;
    default:
      return 0;
  }
}
