import 'server-only';

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ClientAuthContext } from '@/lib/clients/session';
import { parseUuidParam } from '@/lib/security/input-validation';
import { assertOwnedByAuthenticatedClient } from '@/lib/clients/ownership';
import { invoicePaidAndRemaining, roundClientMoney } from '@/lib/clients/workspace-finance';
import {
  addLocalDays,
  clientInvoiceStatusLabel,
  clientInvoiceTone,
  clientProjectPhase,
  clientProjectPhaseLabel,
  clientProjectTypeLabel,
  clientVideoPipelineColumn,
  clientVideoStatusLabel,
  formatClientDate,
  isActiveClientProject,
  startOfLocalDay,
  videoNeedsClientValidation,
} from '@/lib/clients/client-labels';
import type {
  ClientActivityItem,
  ClientAttentionItem,
  ClientFinanceSummary,
  ClientMetric,
  ClientProfileSafe,
  ClientSafeInvoice,
  ClientSafeProject,
  ClientSafeReport,
  ClientSafeVideo,
  ClientWorkspaceOverview,
} from '@/lib/clients/workspace-types';
import {
  isPortalListedVideo,
  PORTAL_LISTED_PUBLIC_STATUSES,
  toPortalVideoRow,
} from '@/lib/portal/video-disclosure';
import { effectiveClientDeliveryIso } from '@/lib/videos/video-schedule';
import { isSensitiveActivityLog } from '@/lib/data/activity-log-display';
import { REPORT_TYPE_LABELS } from '@/types/domain';
import type {
  InvoiceStatus,
  ProjectStatus,
  ReportType,
  VideoPublicStatus,
  VideoStatus,
} from '@/types/database';

export { invoicePaidAndRemaining, roundClientMoney } from '@/lib/clients/workspace-finance';

const VIDEO_SELECT =
  'id, client_id, title, public_status, status, shooting_date, delivery_deadline, client_delivery_at, publication_date, preview_url, final_url, updated_at';

type VideoRow = {
  id: string;
  client_id: string;
  title: string;
  public_status: VideoPublicStatus;
  status: VideoStatus;
  shooting_date: string | null;
  delivery_deadline: string | null;
  client_delivery_at: string | null;
  publication_date: string | null;
  preview_url: string | null;
  final_url: string | null;
  updated_at: string | null;
};

type ProjectRow = {
  id: string;
  client_id: string;
  title: string;
  type: string;
  status: ProjectStatus;
  progress: number | null;
  deadline: string | null;
  delivered_at: string | null;
  updated_at: string | null;
};

type InvoiceRow = {
  id: string;
  client_id: string;
  ref: string;
  status: InvoiceStatus;
  total: number;
  currency: string;
  due_date: string;
  issue_date: string;
  paid_at: string | null;
  pdf_url: string | null;
  pdf_storage_path: string | null;
};

type PaymentRow = { invoice_id: string; amount: number };

type ReportRow = {
  id: string;
  client_id: string;
  title: string;
  type: ReportType;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  created_at: string;
  pdf_url: string | null;
};

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapVideo(
  raw: VideoRow,
  projectByVideoId: Map<string, { id: string; title: string }>,
): ClientSafeVideo {
  const disclosed = toPortalVideoRow(raw);
  const delivery = effectiveClientDeliveryIso({
    client_delivery_at: raw.client_delivery_at,
    delivery_deadline: raw.delivery_deadline,
  });
  const project = projectByVideoId.get(raw.id) ?? null;
  return {
    id: raw.id,
    title: raw.title,
    publicStatus: raw.public_status,
    status: raw.status,
    statusLabel: clientVideoStatusLabel(raw.public_status),
    pipelineColumn: clientVideoPipelineColumn(raw.public_status, raw.status),
    projectId: project?.id ?? null,
    projectTitle: project?.title ?? null,
    shootingDate: raw.shooting_date,
    deliveryDate: delivery,
    publicationDate: raw.publication_date,
    previewUrl: disclosed.preview_url,
    finalUrl: disclosed.final_url,
    updatedAt: raw.updated_at,
    needsValidation: videoNeedsClientValidation(raw),
  };
}

function mapProject(row: ProjectRow, videoCount: number): ClientSafeProject {
  const progress =
    typeof row.progress === 'number' && Number.isFinite(row.progress)
      ? Math.min(100, Math.max(0, Math.round(row.progress)))
      : null;
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    typeLabel: clientProjectTypeLabel(row.type),
    status: row.status,
    phase: clientProjectPhase(row.status, row.type),
    phaseLabel: clientProjectPhaseLabel(row.status, row.type),
    progress,
    deadline: row.deadline,
    deliveredAt: row.delivered_at,
    updatedAt: row.updated_at,
    videoCount,
  };
}

function mapInvoice(row: InvoiceRow, paymentsSum: number): ClientSafeInvoice | null {
  const tone = clientInvoiceTone(row.status);
  if (tone === 'hidden') return null;
  const { paidAmount, remaining } = invoicePaidAndRemaining(Number(row.total), row.status, paymentsSum);
  return {
    id: row.id,
    ref: row.ref,
    status: row.status,
    statusLabel: clientInvoiceStatusLabel(row.status),
    tone,
    total: Number(row.total),
    paidAmount,
    remaining,
    currency: row.currency,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    hasPdf: true, // generated on demand via /api/client/invoices/[id]/pdf
  };
}

function mapReport(row: ReportRow): ClientSafeReport {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    typeLabel: REPORT_TYPE_LABELS[row.type] ?? row.type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
    summary: row.summary,
    pdfUrl: row.pdf_url,
  };
}

async function loadVideoProjectMap(sessionClientId: string) {
  const admin = createAdminClient();
  const map = new Map<string, { id: string; title: string }>();
  const { data, error } = await admin
    .from('tasks')
    .select('video_id, project_id')
    .eq('client_id', sessionClientId)
    .not('video_id', 'is', null)
    .not('project_id', 'is', null);
  if (error || !data?.length) return map;

  const projectIds = [
    ...new Set(data.map((t) => t.project_id as string | null).filter((id): id is string => Boolean(id))),
  ];
  if (projectIds.length === 0) return map;

  const { data: projects } = await admin
    .from('projects')
    .select('id, title, client_id')
    .eq('client_id', sessionClientId)
    .in('id', projectIds);

  const titleById = new Map(
    (projects ?? [])
      .filter((p) => assertOwnedByAuthenticatedClient(p.client_id as string, sessionClientId) === 'ok')
      .map((p) => [p.id as string, p.title as string]),
  );

  for (const t of data) {
    const vid = t.video_id as string | null;
    const pid = t.project_id as string | null;
    if (!vid || !pid) continue;
    const title = titleById.get(pid);
    if (title) map.set(vid, { id: pid, title });
  }
  return map;
}

const loadScopedWorkspace = cache(async (session: ClientAuthContext) => {
  const admin = createAdminClient();
  const clientId = session.clientId;

  const [clientRes, projectRes, videoRes, invoiceRes, paymentRes, reportRes, taskMap] = await Promise.all([
    admin
      .from('clients')
      .select('id, name, monthly_video_quota, currency, color_hex, color_label, logo_url')
      .eq('id', clientId)
      .maybeSingle(),
    admin
      .from('projects')
      .select('id, client_id, title, type, status, progress, deadline, delivered_at, updated_at')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false }),
    admin
      .from('videos')
      .select(VIDEO_SELECT)
      .eq('client_id', clientId)
      .not('status', 'eq', 'archived')
      .not('status', 'eq', 'cancelled')
      .in('public_status', Array.from(PORTAL_LISTED_PUBLIC_STATUSES))
      .order('updated_at', { ascending: false }),
    admin
      .from('invoices')
      .select(
        'id, client_id, ref, status, total, currency, due_date, issue_date, paid_at, pdf_url, pdf_storage_path',
      )
      .eq('client_id', clientId)
      .eq('visible_to_client', true)
      .order('issue_date', { ascending: false }),
    admin.from('payments').select('invoice_id, amount').eq('client_id', clientId),
    admin
      .from('reports')
      .select('id, client_id, title, type, period_start, period_end, summary, created_at, pdf_url')
      .eq('client_id', clientId)
      .eq('visible_to_client', true)
      .order('created_at', { ascending: false }),
    loadVideoProjectMap(clientId),
  ]);

  const profile: ClientProfileSafe = {
    id: clientId,
    name: (clientRes.data?.name as string | undefined) ?? session.clientName ?? 'Votre espace',
    logoUrl: (clientRes.data?.logo_url as string | null | undefined) ?? null,
    colorHex: (clientRes.data?.color_hex as string | null | undefined) ?? null,
    currency: (clientRes.data?.currency as string | undefined) ?? 'MAD',
    monthlyVideoQuota: Number(clientRes.data?.monthly_video_quota ?? 0),
  };

  const projects = ((projectRes.data ?? []) as ProjectRow[]).filter(
    (p) => assertOwnedByAuthenticatedClient(p.client_id, clientId) === 'ok',
  );
  const videosRaw = ((videoRes.data ?? []) as VideoRow[])
    .filter((v) => assertOwnedByAuthenticatedClient(v.client_id, clientId) === 'ok')
    .filter(isPortalListedVideo);
  const invoicesRaw = ((invoiceRes.data ?? []) as InvoiceRow[]).filter(
    (i) => assertOwnedByAuthenticatedClient(i.client_id, clientId) === 'ok',
  );
  const reports = ((reportRes.data ?? []) as ReportRow[]).filter(
    (r) => assertOwnedByAuthenticatedClient(r.client_id, clientId) === 'ok',
  );

  const paidByInvoice = new Map<string, number>();
  for (const p of (paymentRes.data ?? []) as PaymentRow[]) {
    paidByInvoice.set(
      p.invoice_id,
      roundClientMoney((paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0)),
    );
  }

  const videos = videosRaw.map((v) => mapVideo(v, taskMap));
  const videoCountByProject = new Map<string, number>();
  for (const v of videos) {
    if (!v.projectId) continue;
    videoCountByProject.set(v.projectId, (videoCountByProject.get(v.projectId) ?? 0) + 1);
  }

  return {
    admin,
    profile,
    projects: projects.map((p) => mapProject(p, videoCountByProject.get(p.id) ?? 0)),
    videos,
    invoices: invoicesRaw
      .map((i) => mapInvoice(i, paidByInvoice.get(i.id) ?? 0))
      .filter((i): i is ClientSafeInvoice => i !== null),
    reports: reports.map(mapReport),
  };
});

export function buildClientFinance(
  invoices: ClientSafeInvoice[],
  fallbackCurrency: string,
): ClientFinanceSummary {
  const currency = invoices[0]?.currency ?? fallbackCurrency;
  return {
    invoiced: roundClientMoney(invoices.reduce((s, i) => s + i.total, 0)),
    paid: roundClientMoney(invoices.reduce((s, i) => s + i.paidAmount, 0)),
    remaining: roundClientMoney(invoices.reduce((s, i) => s + i.remaining, 0)),
    overdue: roundClientMoney(invoices.filter((i) => i.tone === 'overdue').reduce((s, i) => s + i.remaining, 0)),
    currency,
    hasInvoices: invoices.length > 0,
  };
}

function buildAttention(
  projects: ClientSafeProject[],
  videos: ClientSafeVideo[],
  invoices: ClientSafeInvoice[],
): ClientAttentionItem[] {
  const items: ClientAttentionItem[] = [];

  for (const v of videos.filter((x) => x.needsValidation)) {
    items.push({
      id: `video-${v.id}`,
      kind: 'video_validation',
      title: `${v.title} — En attente de validation`,
      subtitle: v.projectTitle ? `Projet : ${v.projectTitle}` : 'Contenu',
      meta: v.deliveryDate ? `Livraison prévue ${formatClientDate(v.deliveryDate)}` : null,
      href: `/client/videos#video-${v.id}`,
      cta: 'Voir',
      tone: 'warning',
    });
  }

  for (const inv of invoices.filter((i) => i.remaining > 0 && (i.tone === 'overdue' || i.tone === 'pending'))) {
    items.push({
      id: `invoice-${inv.id}`,
      kind: 'invoice',
      title: `${inv.ref} — ${inv.tone === 'overdue' ? 'Paiement en retard' : 'Paiement en attente'}`,
      subtitle: 'Facture',
      meta: `Échéance ${formatClientDate(inv.dueDate) ?? '—'}`,
      href: `/client/invoices#invoice-${inv.id}`,
      cta: 'Voir',
      tone: inv.tone === 'overdue' ? 'danger' : 'warning',
    });
  }

  for (const p of projects.filter((x) => x.status === 'waiting_client' || x.status === 'review')) {
    items.push({
      id: `project-${p.id}`,
      kind: 'project_approval',
      title: `${p.title} — En attente de votre retour`,
      subtitle: p.typeLabel,
      meta: p.deadline ? `Échéance ${formatClientDate(p.deadline)}` : null,
      href: `/client/projects/${p.id}`,
      cta: 'Voir',
      tone: 'warning',
    });
  }

  return items;
}

function pushUpcoming(
  events: Array<ClientAttentionItem & { at: Date }>,
  item: ClientAttentionItem,
  iso: string | null,
  today: Date,
) {
  const d = parseDate(iso);
  if (!d || d < today) return;
  events.push({ ...item, at: d });
}

function buildUpcoming(
  projects: ClientSafeProject[],
  videos: ClientSafeVideo[],
  invoices: ClientSafeInvoice[],
): ClientWorkspaceOverview['upcoming'] {
  const today = startOfLocalDay();
  const weekEnd = addLocalDays(today, 7);
  const events: Array<ClientAttentionItem & { at: Date }> = [];

  for (const v of videos) {
    pushUpcoming(
      events,
      {
        id: `shoot-${v.id}`,
        kind: 'video_validation',
        title: `Tournage — ${v.title}`,
        subtitle: v.projectTitle ?? 'Vidéo',
        meta: formatClientDate(v.shootingDate),
        href: `/client/videos#video-${v.id}`,
        cta: 'Voir',
        tone: 'neutral',
      },
      v.shootingDate,
      today,
    );
    pushUpcoming(
      events,
      {
        id: `delivery-${v.id}`,
        kind: 'video_validation',
        title: `Livraison — ${v.title}`,
        subtitle: v.projectTitle ?? 'Vidéo',
        meta: formatClientDate(v.deliveryDate),
        href: `/client/videos#video-${v.id}`,
        cta: 'Voir',
        tone: 'neutral',
      },
      v.deliveryDate,
      today,
    );
    pushUpcoming(
      events,
      {
        id: `pub-${v.id}`,
        kind: 'video_validation',
        title: `Publication — ${v.title}`,
        subtitle: v.projectTitle ?? 'Vidéo',
        meta: formatClientDate(v.publicationDate),
        href: `/client/videos#video-${v.id}`,
        cta: 'Voir',
        tone: 'neutral',
      },
      v.publicationDate,
      today,
    );
  }

  for (const p of projects.filter((x) => isActiveClientProject(x.status))) {
    pushUpcoming(
      events,
      {
        id: `deadline-${p.id}`,
        kind: 'project_approval',
        title: `Échéance — ${p.title}`,
        subtitle: p.phaseLabel,
        meta: formatClientDate(p.deadline),
        href: `/client/projects/${p.id}`,
        cta: 'Voir',
        tone: 'neutral',
      },
      p.deadline,
      today,
    );
  }

  for (const inv of invoices.filter((i) => i.remaining > 0)) {
    pushUpcoming(
      events,
      {
        id: `due-${inv.id}`,
        kind: 'invoice',
        title: `Échéance facture ${inv.ref}`,
        subtitle: inv.statusLabel,
        meta: formatClientDate(inv.dueDate),
        href: `/client/invoices#invoice-${inv.id}`,
        cta: 'Voir',
        tone: inv.tone === 'overdue' ? 'danger' : 'neutral',
      },
      inv.dueDate,
      today,
    );
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  const todayList: ClientAttentionItem[] = [];
  const week: ClientAttentionItem[] = [];
  const later: ClientAttentionItem[] = [];
  for (const e of events) {
    const { at: _at, ...rest } = e;
    if (e.at < addLocalDays(today, 1)) todayList.push(rest);
    else if (e.at < weekEnd) week.push(rest);
    else later.push(rest);
  }
  return { today: todayList, week, later };
}

function buildMetrics(
  projects: ClientSafeProject[],
  videos: ClientSafeVideo[],
  finance: ClientFinanceSummary,
): ClientMetric[] {
  const active = projects.filter((p) => isActiveClientProject(p.status)).length;
  const inProduction = videos.filter(
    (v) => v.pipelineColumn === 'editing' || v.pipelineColumn === 'to_shoot',
  ).length;
  const waiting = videos.filter((v) => v.needsValidation).length;
  const metrics: ClientMetric[] = [];
  if (active > 0) {
    metrics.push({ key: 'projects', label: 'Projets actifs', kind: 'number', value: active });
  }
  if (inProduction > 0) {
    metrics.push({ key: 'videos', label: 'Contenus en production', kind: 'number', value: inProduction });
  }
  if (waiting > 0) {
    metrics.push({ key: 'validation', label: 'À valider', kind: 'number', value: waiting });
  }
  const now = startOfLocalDay().getTime();
  const upcomingDelivery = videos
    .map((v) => v.deliveryDate)
    .filter((d): d is string => Boolean(d))
    .map((d) => ({ d, t: parseDate(d)?.getTime() ?? NaN }))
    .filter((x) => !Number.isNaN(x.t) && x.t >= now)
    .sort((a, b) => a.t - b.t)[0];
  if (upcomingDelivery) {
    metrics.push({
      key: 'delivery',
      label: 'Prochaine livraison',
      kind: 'text',
      value: formatClientDate(upcomingDelivery.d) ?? '—',
    });
  }
  const nextShoot = videos
    .map((v) => v.shootingDate)
    .filter((d): d is string => Boolean(d))
    .map((d) => ({ d, t: parseDate(d)?.getTime() ?? NaN }))
    .filter((x) => !Number.isNaN(x.t) && x.t >= now)
    .sort((a, b) => a.t - b.t)[0];
  if (nextShoot) {
    metrics.push({
      key: 'shoot',
      label: 'Prochain tournage',
      kind: 'text',
      value: formatClientDate(nextShoot.d) ?? '—',
    });
  }
  if (finance.hasInvoices && finance.remaining > 0) {
    metrics.push({
      key: 'balance',
      label: 'Reste à régler',
      kind: 'money',
      value: finance.remaining,
      currency: finance.currency,
    });
  }
  return metrics.slice(0, 5);
}

function clientActivityTitle(action: string, entityType: string): string | null {
  const a = action.toLowerCase();
  const e = entityType.toLowerCase();
  if (a.includes('validated') || a.includes('video_validated')) return 'Contenu validé';
  if (a.includes('revision')) return 'Modification demandée sur un contenu';
  if (e === 'invoice' && (a === 'created' || a.includes('sent'))) return 'Facture émise';
  if (e === 'payment' || a.includes('paid')) return 'Paiement enregistré';
  if (e === 'video' && a === 'created') return 'Nouveau contenu planifié';
  if (e === 'video' && a === 'updated') return 'Mise à jour d’un contenu';
  if (e === 'project' && a === 'created') return 'Nouveau projet ouvert';
  if (e === 'report') return 'Rapport partagé';
  if (e === 'video') return 'Mise à jour d’un contenu';
  if (e === 'project') return 'Mise à jour d’un projet';
  if (e === 'invoice') return 'Mise à jour d’une facture';
  return null;
}

function synthesizedActivity(
  projects: ClientSafeProject[],
  videos: ClientSafeVideo[],
  invoices: ClientSafeInvoice[],
): ClientActivityItem[] {
  const items: ClientActivityItem[] = [];
  for (const v of videos) {
    if (!v.updatedAt) continue;
    const title = v.needsValidation
      ? `${v.title} — envoyé pour validation`
      : v.pipelineColumn === 'editing'
        ? `${v.title} — en montage`
        : `${v.title} — ${v.statusLabel.toLowerCase()}`;
    items.push({ id: `syn-v-${v.id}`, title, at: v.updatedAt });
  }
  for (const p of projects) {
    if (!p.updatedAt) continue;
    items.push({
      id: `syn-p-${p.id}`,
      title: `${p.title} — ${p.phaseLabel.toLowerCase()}`,
      at: p.updatedAt,
    });
  }
  for (const i of invoices) {
    items.push({
      id: `syn-i-${i.id}`,
      title:
        i.tone === 'paid' ? `Paiement enregistré — ${i.ref}` : `Facture ${i.ref} — ${i.statusLabel.toLowerCase()}`,
      at: i.paidAt ?? i.issueDate,
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}

async function loadActivity(
  admin: ReturnType<typeof createAdminClient>,
  entityIds: string[],
  fallback: ClientActivityItem[],
): Promise<ClientActivityItem[]> {
  if (entityIds.length === 0) return fallback.slice(0, 8);
  const { data, error } = await admin
    .from('activity_logs')
    .select('id, action, entity_type, entity_id, created_at')
    .in('entity_id', entityIds.slice(0, 80))
    .in('entity_type', ['video', 'project', 'invoice', 'payment', 'report'])
    .order('created_at', { ascending: false })
    .limit(24);

  if (error || !data?.length) return fallback.slice(0, 8);

  const items: ClientActivityItem[] = [];
  for (const row of data) {
    if (isSensitiveActivityLog({ entity_type: String(row.entity_type), action: String(row.action) })) continue;
    const title = clientActivityTitle(String(row.action), String(row.entity_type));
    if (!title) continue;
    items.push({ id: String(row.id), title, at: String(row.created_at) });
  }
  return (items.length > 0 ? items : fallback).slice(0, 8);
}

export const loadClientOverview = cache(async (session: ClientAuthContext): Promise<ClientWorkspaceOverview> => {
  const { admin, profile, projects, videos, invoices, reports } = await loadScopedWorkspace(session);
  const finance = buildClientFinance(invoices, profile.currency);
  const fallbackActivity = synthesizedActivity(projects, videos, invoices);
  const activity = await loadActivity(
    admin,
    [...projects.map((p) => p.id), ...videos.map((v) => v.id), ...invoices.map((i) => i.id)],
    fallbackActivity,
  );

  return {
    profile,
    metrics: buildMetrics(projects, videos, finance),
    attention: buildAttention(projects, videos, invoices),
    activeProjects: projects.filter((p) => isActiveClientProject(p.status)).slice(0, 8),
    videos,
    upcoming: buildUpcoming(projects, videos, invoices),
    finance,
    recentInvoices: invoices.slice(0, 4),
    activity,
    reportsAvailable: reports.length > 0,
  };
});

export const loadClientProjects = cache(async (session: ClientAuthContext) => {
  const { projects, videos } = await loadScopedWorkspace(session);
  return { projects, videos };
});

export const loadClientProjectDetail = cache(async (session: ClientAuthContext, rawProjectId: string) => {
  const projectId = parseUuidParam(rawProjectId);
  if (!projectId) return null;
  const { projects, videos } = await loadScopedWorkspace(session);
  const project = projects.find((p) => p.id === projectId) ?? null;
  if (!project) return null;
  return { project, videos: videos.filter((v) => v.projectId === projectId) };
});

export const loadClientVideos = cache(async (session: ClientAuthContext) => {
  const { videos } = await loadScopedWorkspace(session);
  return { videos };
});

export const loadClientPlanning = cache(async (session: ClientAuthContext) => {
  const { projects, videos, invoices } = await loadScopedWorkspace(session);
  return { upcoming: buildUpcoming(projects, videos, invoices), videos, projects };
});

export const loadClientInvoices = cache(async (session: ClientAuthContext) => {
  const { invoices, profile } = await loadScopedWorkspace(session);
  return { invoices, finance: buildClientFinance(invoices, profile.currency) };
});

export const loadClientReports = cache(async (session: ClientAuthContext) => {
  const { reports } = await loadScopedWorkspace(session);
  return { reports };
});

export const loadClientShellProfile = cache(async (session: ClientAuthContext) => {
  const { profile, reports } = await loadScopedWorkspace(session);
  return { ...profile, reportsAvailable: reports.length > 0 };
});
