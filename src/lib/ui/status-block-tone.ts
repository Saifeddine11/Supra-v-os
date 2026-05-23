/**
 * Semantic block / card tones — lecture rapide sans surcharger l’identité Supra.
 * Light: soft tinted backgrounds (pastel) + left accent.
 * Dark: premium near-black card surface; color mainly via borders, icon, badge;
 * tint max ~5–8% via inset ring (no large pastel card fills).
 */
import type {
  InvoiceStatus,
  NotificationPriority,
  QuoteStatus,
  TaskPriority,
  TaskStatus,
  VideoPublicStatus,
  VideoStatus,
} from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';

export type StatusBlockTone = 'danger' | 'warning' | 'info' | 'review' | 'success' | 'muted' | 'neutral';

/** Surface complète (carte, panneau, ligne liste). */
export const STATUS_BLOCK_SURFACE: Record<StatusBlockTone, string> = {
  danger:
    'rounded-xl border border-border/55 border-l-[3px] border-l-red-600/85 bg-red-50/80 shadow-sm dark:border-border/40 dark:border-t dark:border-t-red-500/22 dark:border-l-[3px] dark:border-l-red-500/55 dark:bg-card dark:shadow-sm dark:ring-1 dark:ring-inset dark:ring-red-500/[0.07]',
  warning:
    'rounded-xl border border-border/55 border-l-[3px] border-l-amber-600/80 bg-amber-50/85 shadow-sm dark:border-border/40 dark:border-t dark:border-t-amber-500/20 dark:border-l-[3px] dark:border-l-amber-500/50 dark:bg-card dark:shadow-sm dark:ring-1 dark:ring-inset dark:ring-amber-500/[0.07]',
  info:
    'rounded-xl border border-border/55 border-l-[3px] border-l-blue-600/75 bg-blue-50/75 shadow-sm dark:border-border/40 dark:border-t dark:border-t-blue-500/20 dark:border-l-[3px] dark:border-l-blue-500/50 dark:bg-card dark:shadow-sm dark:ring-1 dark:ring-inset dark:ring-blue-500/[0.07]',
  review:
    'rounded-xl border border-border/55 border-l-[3px] border-l-violet-600/75 bg-violet-50/75 shadow-sm dark:border-border/40 dark:border-t dark:border-t-violet-500/20 dark:border-l-[3px] dark:border-l-violet-500/50 dark:bg-card dark:shadow-sm dark:ring-1 dark:ring-inset dark:ring-violet-500/[0.07]',
  success:
    'rounded-xl border border-border/55 border-l-[3px] border-l-emerald-600/80 bg-emerald-50/75 shadow-sm dark:border-border/40 dark:border-t dark:border-t-emerald-500/20 dark:border-l-[3px] dark:border-l-emerald-500/50 dark:bg-card dark:shadow-sm dark:ring-1 dark:ring-inset dark:ring-emerald-500/[0.07]',
  muted:
    'rounded-xl border border-border/60 border-l-[3px] border-l-muted-foreground/35 bg-muted/45 shadow-sm dark:border-border/42 dark:border-t-border/35 dark:border-l-[3px] dark:border-l-muted-foreground/30 dark:bg-card dark:shadow-sm dark:ring-1 dark:ring-inset dark:ring-border/40',
  neutral:
    'rounded-xl border border-border/70 border-l-[3px] border-l-border/90 bg-card/92 shadow-sm dark:border-border/45 dark:border-t-border/25 dark:border-l-[3px] dark:border-l-border/55 dark:bg-card dark:shadow-sm',
};

/** Petit conteneur d’icône à gauche d’une ligne. */
export const STATUS_ICON_BOX: Record<StatusBlockTone, string> = {
  danger:
    'border-red-500/35 bg-red-500/10 text-red-700 dark:border-red-500/30 dark:bg-red-500/[0.07] dark:text-red-400/95',
  warning:
    'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:border-amber-500/28 dark:bg-amber-500/[0.07] dark:text-amber-400/95',
  info: 'border-blue-500/35 bg-blue-500/10 text-blue-800 dark:border-blue-500/28 dark:bg-blue-500/[0.07] dark:text-blue-400/95',
  review:
    'border-violet-500/35 bg-violet-500/10 text-violet-800 dark:border-violet-500/28 dark:bg-violet-500/[0.07] dark:text-violet-400/95',
  success:
    'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:border-emerald-500/28 dark:bg-emerald-500/[0.07] dark:text-emerald-400/95',
  muted:
    'border-muted-foreground/25 bg-muted/55 text-muted-foreground dark:border-border/50 dark:bg-muted/25 dark:text-muted-foreground',
  neutral: 'border-primary/22 bg-primary/[0.08] text-primary dark:border-primary/35 dark:bg-primary/[0.06] dark:text-primary',
};

/** Glow discret — réservé aux blocs danger urgents (retard, bloqué). */
export const STATUS_BLOCK_URGENT_GLOW =
  'shadow-[0_0_26px_-8px_rgba(220,38,38,0.34)] dark:shadow-[0_0_36px_-10px_rgba(239,68,68,0.28),0_0_0_1px_rgba(239,68,68,0.06)]';

/** Ligne de tableau : accent plus léger que les cartes. */
export const STATUS_TABLE_ROW: Record<StatusBlockTone, string> = {
  danger:
    'border-l-[3px] border-l-red-500/75 bg-red-500/[0.04] dark:border-l-red-500/50 dark:bg-card/40 dark:ring-1 dark:ring-inset dark:ring-red-500/[0.05]',
  warning:
    'border-l-[3px] border-l-amber-500/70 bg-amber-500/[0.04] dark:border-l-amber-500/48 dark:bg-card/40 dark:ring-1 dark:ring-inset dark:ring-amber-500/[0.05]',
  info:
    'border-l-[3px] border-l-blue-500/65 bg-blue-500/[0.03] dark:border-l-blue-500/48 dark:bg-card/40 dark:ring-1 dark:ring-inset dark:ring-blue-500/[0.05]',
  review:
    'border-l-[3px] border-l-violet-500/65 bg-violet-500/[0.03] dark:border-l-violet-500/48 dark:bg-card/40 dark:ring-1 dark:ring-inset dark:ring-violet-500/[0.05]',
  success:
    'border-l-[3px] border-l-emerald-500/70 bg-emerald-500/[0.04] dark:border-l-emerald-500/48 dark:bg-card/40 dark:ring-1 dark:ring-inset dark:ring-emerald-500/[0.05]',
  muted:
    'border-l-[3px] border-l-muted-foreground/25 bg-muted/25 dark:border-l-muted-foreground/28 dark:bg-card/35 dark:ring-1 dark:ring-inset dark:ring-border/35',
  neutral:
    'border-l-[3px] border-l-transparent bg-card/40 dark:border-l-border/40 dark:bg-card/30',
};

export function getStatusBlockSurface(tone: StatusBlockTone, opts?: { urgentGlow?: boolean }): string {
  return cn(STATUS_BLOCK_SURFACE[tone], opts?.urgentGlow && tone === 'danger' ? STATUS_BLOCK_URGENT_GLOW : null);
}

export function getStatusIconBox(tone: StatusBlockTone): string {
  return STATUS_ICON_BOX[tone];
}

export function getStatusTableRowClasses(tone: StatusBlockTone): string {
  return cn(STATUS_TABLE_ROW[tone], 'transition-colors hover:bg-muted/35');
}

export type StatCardUiTone = 'default' | 'positive' | 'negative' | 'warning';

export function statCardUiToneToBlockTone(tone?: StatCardUiTone): StatusBlockTone {
  switch (tone) {
    case 'positive':
      return 'success';
    case 'negative':
      return 'danger';
    case 'warning':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function taskToStatusTone(task: {
  status: TaskStatus;
  deadline?: string | null;
  priority?: TaskPriority;
}): StatusBlockTone {
  const overdue =
    Boolean(task.deadline) &&
    task.status !== 'done' &&
    task.status !== 'archived' &&
    new Date(task.deadline!).getTime() < Date.now();
  if (overdue || task.status === 'blocked') return 'danger';
  if (task.priority === 'urgent' && task.status !== 'done' && task.status !== 'archived') return 'danger';
  if (task.status === 'waiting_client' || task.status === 'waiting_team') return 'warning'; // waiting_team: legacy rows
  if (task.status === 'in_progress') return 'info';
  if (task.status === 'review') return 'review';
  if (task.status === 'done') return 'success';
  if (task.status === 'archived') return 'muted';
  return 'neutral';
}

export function videoWorkflowToStatusTone(
  v: {
    status: VideoStatus;
    public_status?: VideoPublicStatus;
    delivery_deadline?: string | null;
    client_delivery_at?: string | null;
    priority?: TaskPriority;
  },
  opts?: { deliveryOverdue?: boolean },
): StatusBlockTone {
  if (v.status === 'validated' || v.status === 'published') return 'success';
  if (v.status === 'archived' || v.status === 'cancelled') return 'muted';
  if (v.status === 'idea' || v.status === 'brief_pending') return 'muted';

  const od =
    opts?.deliveryOverdue ??
    isVideoDeliveryOverdue({
      status: v.status,
      public_status: v.public_status ?? 'topic_proposed',
      client_delivery_at: v.client_delivery_at ?? null,
      delivery_deadline: v.delivery_deadline ?? null,
    });
  if (od) return 'danger';
  if (v.priority === 'urgent') return 'danger';
  if (v.status === 'client_revision' || v.status === 'internal_review' || v.status === 'editing') return 'review';
  if (v.status === 'sent_to_client' || v.status === 'rushes_received') return 'warning';
  if (
    v.status === 'shooting_done' ||
    v.status === 'shooting_planned' ||
    v.status === 'shooting_in_progress' ||
    v.status === 'brief_validated'
  )
    return 'info';
  return 'neutral';
}

export function invoiceStatusToTone(status: InvoiceStatus, overdueUi?: boolean): StatusBlockTone {
  if (status === 'paid') return 'success';
  if (status === 'overdue' || overdueUi) return 'danger';
  if (status === 'pending' || status === 'sent') return 'warning';
  if (status === 'draft' || status === 'cancelled') return 'muted';
  return 'neutral';
}

export function quoteStatusToTone(
  status: QuoteStatus,
  opts?: { expiredUi?: boolean },
): StatusBlockTone {
  if (status === 'accepted' || status === 'converted') return 'success';
  if (status === 'refused') return 'danger';
  if (status === 'expired' || opts?.expiredUi) return 'muted';
  if (status === 'sent') return 'warning';
  return 'muted';
}

export function notificationPreviewTone(priority: NotificationPriority, isRead: boolean): StatusBlockTone {
  if (!isRead && priority === 'urgent') return 'danger';
  if (!isRead && priority === 'high') return 'warning';
  if (!isRead) return 'info';
  return 'muted';
}

export function notificationListTone(priority: NotificationPriority, isRead: boolean): StatusBlockTone {
  if (!isRead && priority === 'urgent') return 'danger';
  if (!isRead && priority === 'high') return 'warning';
  if (!isRead) return 'info';
  return 'muted';
}

export function workloadPercentToTone(percent: number): StatusBlockTone {
  if (percent >= 88) return 'danger';
  if (percent >= 72) return 'warning';
  if (percent >= 55) return 'info';
  return 'neutral';
}

export function teamAvailabilityToRowTone(
  availability: string,
  isActive: boolean,
  archivedAt: string | null,
): StatusBlockTone {
  if (archivedAt || !isActive) return 'muted';
  if (availability === 'overloaded') return 'danger';
  if (availability === 'inactive') return 'muted';
  if (availability === 'busy') return 'warning';
  if (availability === 'available') return 'success';
  return 'neutral';
}

/** Ligne équipe : retards prioritaires sur la disponibilité. */
export function teamMemberTableRowTone(opts: {
  availability: string;
  is_active: boolean;
  archived_at: string | null;
  overdue_tasks: number;
}): StatusBlockTone {
  if (opts.archived_at || !opts.is_active) return 'muted';
  if (opts.overdue_tasks > 0) return 'danger';
  return teamAvailabilityToRowTone(opts.availability, opts.is_active, opts.archived_at);
}

export function clientFollowTagToTone(tag: 'active' | 'follow-up' | 'portal' | 'invoice'): StatusBlockTone {
  switch (tag) {
    case 'follow-up':
      return 'warning';
    case 'invoice':
      return 'warning';
    case 'portal':
      return 'info';
    case 'active':
      return 'success';
    default:
      return 'neutral';
  }
}

export function mockVideoRowToTone(tone?: 'default' | 'warning' | 'success'): StatusBlockTone {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  return 'info';
}

export function portalVideoPublicStatusToTone(s: VideoPublicStatus): StatusBlockTone {
  switch (s) {
    case 'revision_requested':
      return 'review';
    case 'in_validation':
      return 'warning';
    case 'validated':
    case 'published':
      return 'success';
    case 'topic_proposed':
      return 'muted';
    default:
      return 'info';
  }
}

export function portalQuoteStatusToTone(s: QuoteStatus): StatusBlockTone {
  return quoteStatusToTone(s);
}

export function portalInvoiceStatusToTone(s: InvoiceStatus): StatusBlockTone {
  return invoiceStatusToTone(s);
}

export function dashboardInvoicePreviewLabelToTone(label: string): StatusBlockTone {
  if (label.includes('retard')) return 'danger';
  if (label.includes('attente')) return 'warning';
  if (label.includes('Pay')) return 'success';
  if (label.includes('Brouillon')) return 'muted';
  return 'neutral';
}
