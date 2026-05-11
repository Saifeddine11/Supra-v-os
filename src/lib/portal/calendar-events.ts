/**
 * Événements calendrier portail client — construits uniquement à partir des données
 * exposées par `loadPortalPublicData` (aucune note interne, pas d’équipe, pas d’autres clients).
 */
import {
  addDays,
  endOfDay,
  endOfWeek,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { PortalBundle, PortalVideoRow } from '@/lib/portal/load-public-data';
import { loadPortalPublicData } from '@/lib/portal/load-public-data';
import { effectiveClientDeliveryIso } from '@/lib/videos/video-schedule';
import {
  INVOICE_STATUS_MAP,
  PROJECT_STATUS_MAP,
  QUOTE_STATUS_MAP,
  REPORT_TYPE_LABELS,
  VIDEO_PUBLIC_STATUS_MAP,
} from '@/types/domain';
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

const PAYMENT_SOON_DAYS = 7;

function parseEventDate(raw: string): Date | null {
  const d = parseISO(raw.length <= 10 ? `${raw}T12:00:00` : raw);
  return isValid(d) ? d : null;
}

function toSortKey(d: Date): number {
  return d.getTime();
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

function inCalendarWindow(d: Date, windowStart: Date, windowEnd: Date): boolean {
  return !isBefore(d, windowStart) && !isAfter(d, windowEnd);
}

function invoiceVisualTone(due: Date, today: Date): PortalEventVisualTone {
  const day = startOfDay(today);
  if (isBefore(startOfDay(due), day)) return 'payment_overdue';
  if (inCalendarWindow(due, day, endOfDay(addDays(day, PAYMENT_SOON_DAYS)))) return 'payment_soon';
  return 'payment_future';
}

function needsClientValidationVideo(v: PortalVideoRow): boolean {
  if (v.public_status === 'revision_requested') return false;
  return v.public_status === 'in_validation' || v.status === 'sent_to_client';
}

function isWebsiteProject(type: string | null | undefined): boolean {
  const t = (type ?? '').toLowerCase();
  return t.includes('site') || t.includes('web') || t.includes('seo');
}

/**
 * Construit la liste d’événements à partir du bundle déjà chargé pour le client.
 */
export function buildPortalCalendarEvents(bundle: PortalBundle, now: Date = new Date()): PortalCalendarEvent[] {
  const today = startOfDay(now);
  const windowStart = startOfDay(addDays(today, -30));
  const windowEnd = endOfDay(addDays(today, 400));
  const out: PortalCalendarEvent[] = [];
  const seen = new Set<string>();
  const clientLabel = bundle.client.name;

  const push = (e: Omit<PortalCalendarEvent, 'statusBlockTone'>) => {
    if (seen.has(e.id)) return;
    const d = parseEventDate(e.date);
    if (!d || !inCalendarWindow(d, windowStart, windowEnd)) return;
    seen.add(e.id);
    out.push({ ...e, statusBlockTone: getPortalEventStatusBlockTone(e.tone) });
  };

  for (const v of bundle.videos) {
    const deliveryIso = effectiveClientDeliveryIso({
      client_delivery_at: v.client_delivery_at,
      delivery_deadline: v.delivery_deadline,
    });

    if (v.shooting_date) {
      const d = parseEventDate(v.shooting_date);
      if (d) {
        push({
          id: `shoot__${v.id}`,
          type: 'shoot',
          typeLabel: 'Tournage prévu',
          title: `Tournage — ${v.title}`,
          date: d.toISOString(),
          endDate: null,
          status: VIDEO_PUBLIC_STATUS_MAP[v.public_status].label,
          tone: 'shooting',
          href: `#portal-video-${v.id}`,
          description: `Client : ${clientLabel}`,
          sortKey: toSortKey(d),
        });
      }
    }

    if (v.public_status === 'revision_requested' && deliveryIso) {
      const d = parseEventDate(deliveryIso);
      if (d) {
        push({
          id: `revision__${v.id}`,
          type: 'revision',
          typeLabel: 'Révision vidéo',
          title: `Révision demandée — ${v.title}`,
          date: d.toISOString(),
          endDate: null,
          status: VIDEO_PUBLIC_STATUS_MAP[v.public_status].label,
          tone: 'revision',
          href: `#portal-video-${v.id}`,
          description: 'Merci de valider ou préciser vos retours dans l’espace vidéo.',
          sortKey: toSortKey(d),
        });
      }
    } else if (needsClientValidationVideo(v) && deliveryIso) {
      const d = parseEventDate(deliveryIso);
      if (d) {
        push({
          id: `validation__${v.id}`,
          type: 'video_validation',
          typeLabel: 'Vidéo en validation',
          title: `Validation — ${v.title}`,
          date: d.toISOString(),
          endDate: null,
          status: VIDEO_PUBLIC_STATUS_MAP[v.public_status].label,
          tone: 'validation',
          href: `#portal-video-${v.id}`,
          description: `Client : ${clientLabel}`,
          sortKey: toSortKey(d),
        });
      }
    } else if (
      deliveryIso &&
      v.public_status !== 'published' &&
      v.public_status !== 'validated' &&
      v.status !== 'published' &&
      v.status !== 'validated'
    ) {
      const d = parseEventDate(deliveryIso);
      if (d) {
        push({
          id: `delivery__${v.id}`,
          type: 'video_delivery',
          typeLabel: 'Livraison vidéo prévue',
          title: `Livraison — ${v.title}`,
          date: d.toISOString(),
          endDate: null,
          status: VIDEO_PUBLIC_STATUS_MAP[v.public_status].label,
          tone: 'video_flow',
          href: `#portal-video-${v.id}`,
          description: `Client : ${clientLabel}`,
          sortKey: toSortKey(d),
        });
      }
    }

    if (v.publication_date) {
      const d = parseEventDate(v.publication_date);
      if (d) {
        const published = v.public_status === 'published';
        push({
          id: `publication__${v.id}`,
          type: 'publication',
          typeLabel: published ? 'Publication' : 'Publication prévue',
          title: published ? `Publication — ${v.title}` : `Publication prévue — ${v.title}`,
          date: d.toISOString(),
          endDate: null,
          status: VIDEO_PUBLIC_STATUS_MAP[v.public_status].label,
          tone: 'publication',
          href: `#portal-video-${v.id}`,
          description: null,
          sortKey: toSortKey(d),
        });
      }
    }
  }

  for (const inv of bundle.invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft') continue;

    if (inv.status === 'paid') {
      const raw = inv.paid_at ?? inv.issue_date;
      const d = parseEventDate(raw);
      if (!d) continue;
      push({
        id: `invoice_paid__${inv.id}`,
        type: 'invoice_paid',
        typeLabel: 'Facture payée',
        title: `Facture réglée — ${inv.ref}`,
        date: d.toISOString(),
        endDate: null,
        status: INVOICE_STATUS_MAP[inv.status].label,
        tone: 'invoice_paid',
        href: `#portal-invoice-${inv.id}`,
        description: null,
        sortKey: toSortKey(d),
      });
      continue;
    }

    const d = parseEventDate(inv.due_date);
    if (!d) continue;
    const vis = invoiceVisualTone(d, today);
    const overdue = vis === 'payment_overdue';
    push({
      id: `invoice__${inv.id}`,
      type: overdue ? 'invoice_overdue' : 'payment_due',
      typeLabel: overdue ? 'Facture en retard' : 'Paiement à prévoir',
      title: overdue ? `Facture en retard — ${inv.ref}` : `Échéance facture — ${inv.ref}`,
      date: d.toISOString(),
      endDate: null,
      status: INVOICE_STATUS_MAP[inv.status].label,
      tone: vis,
      href: `#portal-invoice-${inv.id}`,
      description: null,
      sortKey: toSortKey(d),
    });
  }

  for (const q of bundle.quotes) {
    if (q.status === 'accepted' || q.status === 'converted' || q.status === 'refused') continue;
    const d = parseEventDate(q.valid_until);
    if (!d) continue;
    push({
      id: `quote__${q.id}`,
      type: 'quote_validity',
      typeLabel: 'Proposition commerciale',
      title: `Fin de validité — ${(q.proposal_title ?? '').trim() || q.ref}`,
      date: d.toISOString(),
      endDate: null,
      status: QUOTE_STATUS_MAP[q.status].label,
      tone: 'quote',
      href: `#portal-quote-${q.id}`,
      description: null,
      sortKey: toSortKey(d),
    });
  }

  for (const r of bundle.reports) {
    const d =
      (r.sent_at ? parseEventDate(r.sent_at) : null) ??
      (r.period_end ? parseEventDate(r.period_end) : null) ??
      (r.period_start ? parseEventDate(r.period_start) : null) ??
      parseEventDate(r.created_at);
    if (!d) continue;
    const desc = r.summary ? r.summary.replace(/\s+/g, ' ').trim() : null;
    const isMonthly = r.type === 'monthly';
    push({
      id: `report__${r.id}`,
      type: 'report',
      typeLabel: isMonthly ? 'Rapport mensuel' : 'Rapport disponible',
      title: r.title,
      date: d.toISOString(),
      endDate: null,
      status: REPORT_TYPE_LABELS[r.type],
      tone: 'report',
      href: `#portal-report-${r.id}`,
      description: desc,
      sortKey: toSortKey(d),
    });
  }

  for (const p of bundle.projects) {
    if (p.delivered_at) {
      const d = parseEventDate(p.delivered_at);
      if (d) {
        const web = isWebsiteProject(p.type);
        push({
          id: `project_delivery__${p.id}`,
          type: 'project_delivery',
          typeLabel: web ? 'Livraison site web' : 'Livraison projet',
          title: web ? `Livraison site web — ${p.title}` : `Livraison projet — ${p.title}`,
          date: d.toISOString(),
          endDate: null,
          status: PROJECT_STATUS_MAP[p.status].label,
          tone: 'milestone',
          href: `#portal-project-${p.id}`,
          description: null,
          sortKey: toSortKey(d),
        });
      }
    }

    if (p.deadline) {
      const d = parseEventDate(p.deadline);
      if (d) {
        const web = isWebsiteProject(p.type);
        push({
          id: `project__${p.id}`,
          type: 'project_milestone',
          typeLabel: web ? 'Échéance site web' : 'Jalon projet',
          title: web ? `Échéance site web — ${p.title}` : `Échéance projet — ${p.title}`,
          date: d.toISOString(),
          endDate: null,
          status: PROJECT_STATUS_MAP[p.status].label,
          tone: 'milestone',
          href: `#portal-project-${p.id}`,
          description: p.progress != null ? `Avancement : ${p.progress} %` : null,
          sortKey: toSortKey(d),
        });
      }
    }
  }

  for (const rm of bundle.roadmaps) {
    const raw = rm.period_start ?? rm.uploaded_at?.slice(0, 10) ?? null;
    const d = raw ? parseEventDate(raw) : null;
    if (!d) continue;
    const endRaw = rm.period_end ? parseEventDate(rm.period_end) : null;
    push({
      id: `roadmap__${rm.id}`,
      type: 'roadmap',
      typeLabel: 'Roadmap',
      title: rm.name,
      date: d.toISOString(),
      endDate: endRaw ? endRaw.toISOString() : null,
      status: 'Partagée',
      tone: 'milestone',
      href: `#portal-roadmap-${rm.id}`,
      description: 'Feuille de route mensuelle',
      sortKey: toSortKey(d),
    });
  }

  out.sort((a, b) => a.sortKey - b.sortKey);
  return out.map(sanitizePortalCalendarEvent);
}

export async function loadPortalCalendarEvents(clientId: string, now?: Date): Promise<PortalCalendarEvent[] | null> {
  const bundle = await loadPortalPublicData(clientId);
  if (!bundle) return null;
  return buildPortalCalendarEvents(bundle, now);
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
