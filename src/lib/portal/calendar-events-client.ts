/**
 * Types + filtres calendrier portail — importables côté client (sans `server-only`).
 */
import type { StatusBlockTone } from '@/lib/ui/status-block-tone';

export type PortalCalendarEventType =
  | 'shoot'
  | 'video_delivery'
  | 'video_validation'
  | 'revision'
  | 'publication'
  | 'payment_due'
  | 'invoice_overdue'
  | 'invoice_paid'
  | 'quote_validity'
  | 'project_milestone'
  | 'project_delivery'
  | 'report'
  | 'roadmap';

export type PortalEventVisualTone =
  | 'shooting'
  | 'video_flow'
  | 'validation'
  | 'publication'
  | 'revision'
  | 'payment_overdue'
  | 'payment_soon'
  | 'payment_future'
  | 'invoice_paid'
  | 'report'
  | 'milestone'
  | 'quote'
  | 'neutral';

export interface PortalCalendarEvent {
  id: string;
  type: PortalCalendarEventType;
  typeLabel: string;
  title: string;
  date: string;
  endDate: string | null;
  status: string;
  tone: PortalEventVisualTone;
  statusBlockTone: StatusBlockTone;
  /** Ancre section portail uniquement (pas d’URL arbitraires). */
  href: string | null;
  description: string | null;
  sortKey: number;
}

export function getPortalEventStatusBlockTone(tone: PortalEventVisualTone): StatusBlockTone {
  switch (tone) {
    case 'shooting':
      return 'info';
    case 'validation':
    case 'quote':
      return 'warning';
    case 'publication':
      return 'review';
    case 'video_flow':
      return 'info';
    case 'revision':
    case 'payment_overdue':
      return 'danger';
    case 'payment_soon':
      return 'warning';
    case 'payment_future':
      return 'muted';
    case 'invoice_paid':
      return 'success';
    case 'report':
      return 'success';
    case 'milestone':
      return 'neutral';
    case 'neutral':
    default:
      return 'neutral';
  }
}

function safeHref(href: string | null): string | null {
  if (!href || !href.startsWith('#portal-')) return null;
  return href.length <= 200 ? href : null;
}

export function sanitizePortalCalendarEvent(e: PortalCalendarEvent): PortalCalendarEvent {
  return {
    id: e.id.slice(0, 128),
    type: e.type,
    typeLabel: e.typeLabel.slice(0, 80),
    title: e.title.slice(0, 280),
    date: e.date.slice(0, 40),
    endDate: e.endDate ? e.endDate.slice(0, 40) : null,
    status: e.status.slice(0, 160),
    tone: e.tone,
    statusBlockTone: e.statusBlockTone,
    href: safeHref(e.href),
    description: e.description ? e.description.slice(0, 400) : null,
    sortKey: e.sortKey,
  };
}

export type PortalCalendarFilterId =
  | 'all'
  | 'shooting'
  | 'delivery'
  | 'video'
  | 'publication'
  | 'payment'
  | 'project'
  | 'report';

export function portalEventMatchesFilter(e: PortalCalendarEvent, filter: PortalCalendarFilterId): boolean {
  if (filter === 'all') return true;
  if (filter === 'shooting') return e.type === 'shoot';
  if (filter === 'delivery') return e.type === 'video_delivery';
  if (filter === 'video') return e.type === 'video_validation' || e.type === 'revision';
  if (filter === 'publication') return e.type === 'publication';
  if (filter === 'payment')
    return e.type === 'payment_due' || e.type === 'invoice_overdue' || e.type === 'invoice_paid' || e.type === 'quote_validity';
  if (filter === 'project')
    return e.type === 'project_milestone' || e.type === 'project_delivery' || e.type === 'roadmap';
  if (filter === 'report') return e.type === 'report';
  return true;
}
