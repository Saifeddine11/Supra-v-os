import { createAdminClient } from '@/lib/supabase/admin';
import {
  isPortalListedVideo,
  PORTAL_LISTED_PUBLIC_STATUSES,
  toPortalVideoRow,
} from '@/lib/portal/video-disclosure';
import type { Client, DocumentRecord, Invoice, Project, QuoteStatus, Report, Video } from '@/types/database';

export interface PortalVideoRow {
  id: string;
  title: string;
  public_status: Video['public_status'];
  status: Video['status'];
  shooting_date: string | null;
  delivery_deadline: string | null;
  client_delivery_at: string | null;
  publication_date: string | null;
  preview_url: string | null;
  final_url: string | null;
}

export interface PortalBundle {
  client: Pick<Client, 'id' | 'name' | 'monthly_video_quota' | 'currency'>;
  projects: Pick<Project, 'id' | 'title' | 'status' | 'progress' | 'deadline' | 'type' | 'delivered_at'>[];
  videos: PortalVideoRow[];
  invoices: Pick<
    Invoice,
    'id' | 'ref' | 'status' | 'total' | 'currency' | 'due_date' | 'issue_date' | 'paid_at'
  >[];
  documents: Pick<
    DocumentRecord,
    | 'id'
    | 'name'
    | 'type'
    | 'file_url'
    | 'external_link'
    | 'file_storage_path'
    | 'uploaded_at'
    | 'period_start'
    | 'period_end'
  >[];
  /** Roadmaps visibles (sous-ensemble filtré, même source sécurisée). */
  roadmaps: Pick<
    DocumentRecord,
    | 'id'
    | 'name'
    | 'type'
    | 'file_url'
    | 'external_link'
    | 'file_storage_path'
    | 'uploaded_at'
    | 'period_start'
    | 'period_end'
  >[];
  reports: Pick<
    Report,
    | 'id'
    | 'title'
    | 'type'
    | 'summary'
    | 'period_start'
    | 'period_end'
    | 'next_actions'
    | 'recommendations'
    | 'created_at'
    | 'sent_at'
  >[];
  quotes: {
    id: string;
    ref: string;
    proposal_title: string | null;
    package_name: string | null;
    status: QuoteStatus;
    total: number;
    currency: string;
    valid_until: string;
    issue_date: string;
  }[];
}

export async function loadPortalPublicData(clientId: string): Promise<PortalBundle | null> {
  const admin = createAdminClient();

  const { data: client, error: cErr } = await admin
    .from('clients')
    .select('id, name, monthly_video_quota, currency')
    .eq('id', clientId)
    .maybeSingle();
  if (cErr || !client) return null;

  const [projRes, vidRes, invRes, docRes, repRes, quoteRes] = await Promise.all([
    admin
      .from('projects')
      .select('id, title, status, progress, deadline, type, delivered_at')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false }),
    admin
      .from('videos')
      .select(
        'id, title, public_status, status, shooting_date, delivery_deadline, client_delivery_at, publication_date, preview_url, final_url'
      )
      .eq('client_id', clientId)
      .not('status', 'eq', 'archived')
      .not('status', 'eq', 'cancelled')
      .in('public_status', Array.from(PORTAL_LISTED_PUBLIC_STATUSES))
      .order('updated_at', { ascending: false }),
    admin
      .from('invoices')
      .select('id, ref, status, total, currency, due_date, issue_date, paid_at')
      .eq('client_id', clientId)
      .eq('visible_to_client', true)
      .order('issue_date', { ascending: false }),
    admin
      .from('documents')
      .select(
        'id, name, type, file_url, external_link, file_storage_path, uploaded_at, period_start, period_end'
      )
      .eq('client_id', clientId)
      .eq('visible_to_client', true)
      .order('uploaded_at', { ascending: false }),
    admin
      .from('reports')
      .select(
        'id, title, type, summary, period_start, period_end, next_actions, recommendations, created_at, sent_at'
      )
      .eq('client_id', clientId)
      .eq('visible_to_client', true)
      .order('created_at', { ascending: false }),
    admin
      .from('quotes')
      .select(
        'id, ref, proposal_title, package_name, status, total, currency, valid_until, issue_date'
      )
      .eq('client_id', clientId)
      .eq('visible_to_client', true)
      .order('issue_date', { ascending: false }),
  ]);

  const videoRaw = (vidRes.data ?? []) as PortalVideoRow[];
  const videos = videoRaw.filter(isPortalListedVideo).map(toPortalVideoRow);

  const docRows =
    (docRes.data ?? []) as PortalBundle['documents'];
  const roadmaps = docRows
    .filter((d) => d.type === 'roadmap')
    .sort((a, b) => {
      const ad = a.period_start ?? a.uploaded_at;
      const bd = b.period_start ?? b.uploaded_at;
      return bd.localeCompare(ad);
    });
  const documents = docRows.filter((d) => d.type !== 'roadmap');

  return {
    client,
    projects: projRes.data ?? [],
    videos,
    invoices: invRes.data ?? [],
    documents,
    roadmaps,
    reports: repRes.data ?? [],
    quotes: quoteRes.data ?? [],
  };
}
