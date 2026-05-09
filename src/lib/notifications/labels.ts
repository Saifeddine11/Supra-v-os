import type { NotificationPriority, NotificationType } from '@/types/database';

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
};

export const NOTIFICATION_PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: 'Faible',
  normal: 'Normal',
  high: 'Élevée',
  urgent: 'Urgent',
};
