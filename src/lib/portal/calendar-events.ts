/**
 * Événements calendrier portail client — construits uniquement à partir des données
 * déjà exposées par `loadPortalPublicData` (aucune note interne, pas d’équipe).
 */
import {
  addDays,
  endOfDay,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { PortalBundle, PortalVideoRow } from '@/lib/portal/load-public-data';
import { loadPortalPublicData } from '@/lib/portal/load-public-data';
import { INVOICE_STATUS_MAP, QUOTE_STATUS_MAP, VIDEO_PUBLIC_STATUS_MAP } from '@/types/domain';
import type { InvoiceStatus } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { getStatusBlockSurface } from '@/lib/ui/status-block-tone';
import type { StatusBlockTone } from '@/lib/ui/status-block-tone';

export type PortalCalendarEventType =
  | 'shooting'
  | 'video_validation'
  | 'publication'
  | 'revision'
  | 'invoice_due'
  | 'quote_validity'
  | 'report'
  | 'project_milestone'
  | 'document';

/** Nuance visuelle (couleurs sémantiques portail, distinctes du ton badge staff). */
export type PortalEventVisualTone =
  | 'shooting'
  | 'validation'
  | 'publication'
  | 'revision'
  | 'payment_overdue'
  | 'payment_soon'
  | 'payment_future'
  | 'report'
  | 'milestone'
  | 'quote'
  | 'document'
  | 'neutral';

export interface PortalCalendarEvent {
  id: string;
  type: PortalCalendarEventType;
  typeLabel: string;
  title: string;
  /** ISO instant ou date (tri / affichage). */
  date: string;
  endDate: string | null;
  status: string;
  tone: PortalEventVisualTone;
  statusBlockTone: StatusBlockTone;
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

/** Surface carte événement (portail) — réutilise les blocs sémantiques + accent projet. */
export function portalCalendarEventSurface(e: PortalCalendarEvent): string {
  return cn(
    getStatusBlockSurface(e.statusBlockTone, { urgentGlow: e.tone === 'payment_overdue' }),
    e.tone === 'milestone' && 'ring-1 ring-primary/18 dark:ring-primary/22',
  );
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
    case 'revision':
    case 'payment_overdue':
      return 'danger';
    case 'payment_soon':
      return 'warning';
    case 'payment_future':
      return 'muted';
    case 'report':
      return 'success';
    case 'milestone':
      return 'neutral';
    case 'document':
      return 'muted';
    default:
      return 'neutral';
  }
}

/** Expose uniquement les champs publics (sérialisation client). */
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
    href: e.href && e.href.startsWith('#') ? e.href.slice(0, 120) : e.href ? e.href.slice(0, 512) : null,
    description: e.description ? e.description.slice(0, 400) : null,
    sortKey: e.sortKey,
  };
}

function inCalendarWindow(d: Date, windowStart: Date, windowEnd: Date): boolean {
  return !isBefore(d, windowStart) && !isAfter(d, windowEnd);
}

function invoicePaymentTone(due: Date, today: Date, status: InvoiceStatus): PortalEventVisualTone {
  if (status === 'paid') return 'neutral';
  const day = startOfDay(today);
  if (isBefore(startOfDay(due), day)) return 'payment_overdue';
  if (inCalendarWindow(due, day, endOfDay(addDays(day, PAYMENT_SOON_DAYS)))) return 'payment_soon';
  return 'payment_future';
}

function needsClientValidationVideo(v: PortalVideoRow): boolean {
  if (v.public_status === 'revision_requested') return false;
  return v.public_status === 'in_validation' || v.status === 'sent_to_client';
}

/**
 * Construit la liste d’événements à partir du bundle déjà chargé pour le client
 * (même filtre RLS / visibilité que le portail).
 */
export function buildPortalCalendarEvents(bundle: PortalBundle, now: Date = new Date()): PortalCalendarEvent[] {
  const today = startOfDay(now);
  const windowStart = startOfDay(addDays(today, -30));
  const windowEnd = endOfDay(addDays(today, 400));
  const out: PortalCalendarEvent[] = [];
  const seen = new Set<string>();

  const push = (e: Omit<PortalCalendarEvent, 'statusBlockTone'>) => {
    if (seen.has(e.id)) return;
    const d = parseEventDate(e.date);
    if (!d || !inCalendarWindow(d, windowStart, windowEnd)) return;
    seen.add(e.id);
    const statusBlockTone = getPortalEventStatusBlockTone(e.tone);
    out.push({ ...e, statusBlockTone });
  };

  for (const v of bundle.videos) {
    if (v.shooting_date) {
      const d = parseEventDate(v.shooting_date);
      if (d) {
        push({
          id: `shooting__${v.id}`,
          type: 'shooting',
          typeLabel: 'Tournage',
          title: `Tournage — ${v.title}`,
          date: d.toISOString(),
          endDate: null,
          status: VIDEO_PUBLIC_STATUS_MAP[v.public_status].label,
          tone: 'shooting',
          href: `#portal-video-${v.id}`,
          description: null,
          sortKey: toSortKey(d),
        });
      }
    }

    if (v.public_status === 'revision_requested' && v.delivery_deadline) {
      const d = parseEventDate(v.delivery_deadline);
      if (d) {
        push({
          id: `revision__${v.id}`,
          type: 'revision',
          typeLabel: 'Révision',
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
    } else if (needsClientValidationVideo(v) && v.delivery_deadline) {
      const d = parseEventDate(v.delivery_deadline);
      if (d) {
        push({
          id: `validation__${v.id}`,
          type: 'video_validation',
          typeLabel: 'Validation vidéo',
          title: `Échéance validation — ${v.title}`,
          date: d.toISOString(),
          endDate: null,
          status: VIDEO_PUBLIC_STATUS_MAP[v.public_status].label,
          tone: 'validation',
          href: `#portal-video-${v.id}`,
          description: null,
          sortKey: toSortKey(d),
        });
      }
    }

    if (v.publication_date) {
      const d = parseEventDate(v.publication_date);
      if (d) {
        push({
          id: `publication__${v.id}`,
          type: 'publication',
          typeLabel: 'Publication',
          title:
            v.public_status === 'published'
              ? `Publication — ${v.title}`
              : `Publication prévue — ${v.title}`,
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
    if (inv.status === 'paid' || inv.status === 'cancelled' || inv.status === 'draft') continue;
    const d = parseEventDate(inv.due_date);
    if (!d) continue;
    const tone = invoicePaymentTone(d, today, inv.status);
    push({
      id: `invoice__${inv.id}`,
      type: 'invoice_due',
      typeLabel: 'Facture',
      title: `Échéance facture ${inv.ref}`,
      date: d.toISOString(),
      endDate: null,
      status: INVOICE_STATUS_MAP[inv.status].label,
      tone,
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
      typeLabel: 'Proposition',
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
      (r.period_end ? parseEventDate(r.period_end) : null) ??
      (r.period_start ? parseEventDate(r.period_start) : null) ??
      parseEventDate(r.created_at);
    if (!d) continue;
    const desc = r.summary ? r.summary.replace(/\s+/g, ' ').trim() : null;
    push({
      id: `report__${r.id}`,
      type: 'report',
      typeLabel: 'Rapport',
      title: r.title,
      date: d.toISOString(),
      endDate: null,
      status: r.type,
      tone: 'report',
      href: `#portal-report-${r.id}`,
      description: desc,
      sortKey: toSortKey(d),
    });
  }

  for (const p of bundle.projects) {
    if (!p.deadline) continue;
    const d = parseEventDate(p.deadline);
    if (!d) continue;
    push({
      id: `project__${p.id}`,
      type: 'project_milestone',
      typeLabel: 'Projet',
      title: `Échéance projet — ${p.title}`,
      date: d.toISOString(),
      endDate: null,
      status: p.status,
      tone: 'milestone',
      href: `#portal-project-${p.id}`,
      description: p.progress != null ? `Avancement indiqué : ${p.progress} %` : null,
      sortKey: toSortKey(d),
    });
  }

  const docRecentCutoff = startOfDay(addDays(today, -14));
  for (const doc of bundle.documents) {
    const raw = doc.uploaded_at;
    const d = parseEventDate(raw);
    if (!d) continue;
    if (isBefore(startOfDay(d), docRecentCutoff)) continue;
    push({
      id: `document__${doc.id}`,
      type: 'document',
      typeLabel: 'Document',
      title: doc.name,
      date: d.toISOString(),
      endDate: null,
      status: doc.type ?? 'Document',
      tone: 'document',
      href: `#portal-document-${doc.id}`,
      description: 'Disponible dans votre espace documents.',
      sortKey: toSortKey(d),
    });
  }

  out.sort((a, b) => a.sortKey - b.sortKey);
  return out.map(sanitizePortalCalendarEvent);
}

/**
 * Recharge le bundle côté serveur — à n’appeler qu’après validation du token,
 * avec le même `clientId` que le portail.
 */
export async function loadPortalCalendarEvents(
  clientId: string,
  now?: Date,
): Promise<PortalCalendarEvent[] | null> {
  const bundle = await loadPortalPublicData(clientId);
  if (!bundle) return null;
  return buildPortalCalendarEvents(bundle, now);
}

export type PortalCalendarFilterId =
  | 'all'
  | 'shooting'
  | 'validation'
  | 'payment'
  | 'report'
  | 'publication';

export function portalEventMatchesFilter(e: PortalCalendarEvent, filter: PortalCalendarFilterId): boolean {
  if (filter === 'all') return true;
  if (filter === 'shooting') return e.type === 'shooting';
  if (filter === 'validation') return e.type === 'video_validation' || e.type === 'revision';
  if (filter === 'payment') return e.type === 'invoice_due' || e.type === 'quote_validity';
  if (filter === 'report') return e.type === 'report';
  if (filter === 'publication') return e.type === 'publication';
  return true;
}
