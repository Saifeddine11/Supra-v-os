/**
 * Portal data sanitizers
 * --------------------------------------------------------------------------
 * NEVER send internal data to the client portal. These functions strip
 * sensitive fields (notes_internal, marges, charge équipe, autres clients)
 * before serializing to the browser.
 *
 * Rule: when in doubt, omit it. The portal should be opt-in for every field.
 */

import type {
  Video,
  Invoice,
  Quote,
  Report,
  DocumentRecord,
  PortalVideo,
  PortalInvoice,
  Client,
} from '@/types/database';

export function sanitizeClient(c: Client) {
  return {
    id: c.id,
    name: c.name,
    sector: c.sector,
    avatar_initials: c.avatar_initials,
    avatar_color: c.avatar_color,
    monthly_video_quota: c.monthly_video_quota,
  };
}

export function sanitizeVideo(v: Video): PortalVideo {
  return {
    id: v.id,
    title: v.title,
    type: v.type,
    format: v.format,
    platform: v.platform,
    public_status: v.public_status,
    delivery_deadline: v.delivery_deadline,
    publication_date: v.publication_date,
    preview_url: v.preview_url,
    final_url: v.final_url,
  };
}

export function sanitizeInvoice(i: Invoice): PortalInvoice | null {
  // Only show invoices flagged visible
  if (!i.visible_to_client) return null;
  return {
    id: i.id,
    ref: i.ref,
    issue_date: i.issue_date,
    due_date: i.due_date,
    status: i.status,
    total: i.total,
    currency: i.currency,
    pdf_url: i.pdf_url,
  };
}

export function sanitizeQuote(q: Quote) {
  if (!q.visible_to_client) return null;
  return {
    id: q.id,
    ref: q.ref,
    proposal_title: q.proposal_title,
    package_name: q.package_name,
    issue_date: q.issue_date,
    valid_until: q.valid_until,
    status: q.status,
    total: q.total,
    currency: q.currency,
    pdf_url: q.pdf_url,
  };
}

export function sanitizeReport(r: Report) {
  if (!r.visible_to_client) return null;
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    period_start: r.period_start,
    period_end: r.period_end,
    summary: r.summary,
    highlights: r.highlights,
    metrics: r.metrics,
    next_actions: r.next_actions,
    pdf_url: r.pdf_url,
    sent_at: r.sent_at,
  };
}

export function sanitizeDocument(d: DocumentRecord) {
  if (!d.visible_to_client) return null;
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    description: d.description,
    file_url: d.file_url,
    external_link: d.external_link,
    uploaded_at: d.uploaded_at,
  };
}
