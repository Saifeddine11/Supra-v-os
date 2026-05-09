/**
 * Fixture data for HTML preview and admin test sends — no real client data.
 */
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { MorningReminderProps } from '@/lib/email/templates/morning-reminder';
import type { DeadlineAlertProps } from '@/lib/email/templates/deadline-alert';
import type { EveningSummaryProps } from '@/lib/email/templates/evening-summary';
import type { InvoiceReminderProps } from '@/lib/email/templates/invoice-reminder';
import type { ClientFeedbackProps } from '@/lib/email/templates/client-feedback';
import type { QuoteExpiringProps } from '@/lib/email/templates/quote-expiring';

export function sampleDateLabel(now = new Date()): string {
  return format(now, 'EEEE d MMMM yyyy', { locale: fr });
}

export function morningReminderSample(base: string, recipientName: string, now = new Date()): MorningReminderProps {
  return {
    recipientName,
    date: sampleDateLabel(now),
    tasksToday: [
      'Finaliser le montage Dessert Signature — 18:00',
      'Relecture vidéo Hôtel Atlas Spa',
    ],
    urgentTasks: ['Contrôle qualité assets campagne'],
    overdueTasks: ['Révision Villa Luxe V2'],
    dashboardUrl: `${base}/dashboard`,
  };
}

export function deadlineAlertSample(base: string, recipientName: string): DeadlineAlertProps {
  return {
    recipientName,
    entityTitle: 'Teaser Emara Estates',
    entityType: 'Tâche',
    clientName: 'Emara Estates',
    deadline: '10 févr. 2026 14:00',
    priority: 'urgent',
    actionUrl: `${base}/tasks`,
  };
}

export function eveningSummarySample(base: string, recipientName: string, now = new Date()): EveningSummaryProps {
  return {
    recipientName,
    date: sampleDateLabel(now),
    completedTasks: ['Validation brief — Atlas'],
    remainingTasks: ['Montage suite B-roll'],
    overdueTasks: [],
    tomorrowTasks: ['Étalonnage — campagne Riad'],
    dashboardUrl: `${base}/dashboard`,
  };
}

export function invoiceReminderSample(base: string, recipientName: string): InvoiceReminderProps {
  return {
    recipientName,
    invoiceRef: 'FAC-2026-014',
    amount: '22 000 MAD',
    dueDate: '15 févr. 2026',
    status: 'En attente de paiement',
    invoiceUrl: `${base}/invoices`,
  };
}

export function clientFeedbackSample(base: string, recipientName: string): ClientFeedbackProps {
  return {
    recipientName,
    clientName: 'Riad Atlas',
    entityTitle: 'Vidéo suite parentale',
    feedbackType: 'revision_requested',
    comment: 'Merci de raccourcir l’introduction d’environ 3 secondes.',
    actionUrl: `${base}/videos`,
  };
}

export function quoteExpiringSample(base: string, recipientName: string): QuoteExpiringProps {
  return {
    recipientName,
    quoteRef: 'DEV-2026-008',
    clientName: 'Villa Luxe',
    validUntil: '20 févr. 2026',
    amount: '48 000 MAD',
    quoteUrl: `${base}/quotes`,
  };
}
