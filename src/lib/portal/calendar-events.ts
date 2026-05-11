/**
 * Événements calendrier portail client — construits uniquement à partir des données
 * exposées par `loadPortalPublicData` (aucune note interne, pas d’équipe, pas d’autres clients).
 */
import 'server-only';

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
import {
  getPortalEventStatusBlockTone,
  sanitizePortalCalendarEvent,
  type PortalCalendarEvent,
  type PortalEventVisualTone,
} from '@/lib/portal/calendar-events-client';

export type {
  PortalCalendarEventType,
  PortalEventVisualTone,
  PortalCalendarEvent,
  PortalCalendarFilterId,
} from '@/lib/portal/calendar-events-client';
export { getPortalEventStatusBlockTone, sanitizePortalCalendarEvent, portalEventMatchesFilter } from '@/lib/portal/calendar-events-client';

const PAYMENT_SOON_DAYS = 7;

function parseEventDate(raw: string): Date | null {
  const d = parseISO(raw.length <= 10 ? `${raw}T12:00:00` : raw);
  return isValid(d) ? d : null;
}

function toSortKey(d: Date): number {
  return d.getTime();
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
