/**
 * Notification display metadata — labels copied from the web app
 * (src/lib/notifications/labels.ts) for consistency.
 */
import { colors } from '@/constants/theme';

export type NotificationType =
  | 'task_assigned'
  | 'task_overdue'
  | 'task_deadline_approaching'
  | 'deadline_soon'
  | 'client_validated'
  | 'client_revision_requested'
  | 'invoice_overdue'
  | 'invoice_due_soon'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'quote_accepted'
  | 'quote_expiring'
  | 'quote_converted'
  | 'quota_incomplete'
  | 'employee_overloaded'
  | 'employee_task_not_updated'
  | 'report_due'
  | 'comment_added'
  | 'document_uploaded'
  | 'morning_summary'
  | 'evening_summary'
  | 'system'
  | 'critical_alert_reminder';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  task_assigned: 'Tâche assignée',
  task_overdue: 'Tâche en retard',
  task_deadline_approaching: 'Échéance tâche proche',
  deadline_soon: 'Échéance proche',
  client_validated: 'Validation client',
  client_revision_requested: 'Révision demandée',
  invoice_overdue: 'Facture en retard',
  invoice_due_soon: 'Facture — échéance proche',
  invoice_sent: 'Facture envoyée',
  invoice_paid: 'Facture payée',
  quote_accepted: 'Devis accepté',
  quote_expiring: 'Devis expire bientôt',
  quote_converted: 'Devis converti',
  quota_incomplete: 'Quota vidéo',
  employee_overloaded: 'Charge équipe',
  employee_task_not_updated: 'Tâche à mettre à jour',
  report_due: 'Rapport à envoyer',
  comment_added: 'Commentaire',
  document_uploaded: 'Document',
  morning_summary: 'Rappel matinal',
  evening_summary: 'Bilan de fin de journée',
  system: 'Système',
  critical_alert_reminder: 'Rappel critique',
};

export function notificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type as NotificationType] ?? 'Notification';
}

export function priorityColor(priority: NotificationPriority): string {
  switch (priority) {
    case 'urgent':
      return colors.danger;
    case 'high':
      return colors.orange;
    default:
      return colors.muted;
  }
}

/** Relative "il y a…" label for feed timestamps. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return 'à l’instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? 'hier' : `il y a ${days} j`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'il y a 1 sem.' : `il y a ${weeks} sem.`;
}
