import type {
  InvoiceStatus,
  ProjectStatus,
  ReportType,
  VideoPublicStatus,
  VideoStatus,
} from '@/types/database';
import type { ClientPipelineColumn, ClientProjectPhase } from '@/lib/clients/client-labels';

export type ClientSafeProject = {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  status: ProjectStatus;
  phase: ClientProjectPhase;
  phaseLabel: string;
  progress: number | null;
  deadline: string | null;
  deliveredAt: string | null;
  updatedAt: string | null;
  videoCount: number;
};

export type ClientSafeVideo = {
  id: string;
  title: string;
  publicStatus: VideoPublicStatus;
  status: VideoStatus;
  statusLabel: string;
  pipelineColumn: ClientPipelineColumn;
  projectId: string | null;
  projectTitle: string | null;
  shootingDate: string | null;
  deliveryDate: string | null;
  publicationDate: string | null;
  previewUrl: string | null;
  finalUrl: string | null;
  updatedAt: string | null;
  needsValidation: boolean;
};

export type ClientSafeInvoice = {
  id: string;
  ref: string;
  status: InvoiceStatus;
  statusLabel: string;
  tone: 'paid' | 'pending' | 'overdue';
  total: number;
  paidAmount: number;
  remaining: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  hasPdf: boolean;
};

export type ClientSafeReport = {
  id: string;
  title: string;
  type: ReportType;
  typeLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  summary: string | null;
  pdfUrl: string | null;
};

export type ClientAttentionItem = {
  id: string;
  kind: 'video_validation' | 'invoice' | 'project_approval';
  title: string;
  subtitle: string;
  meta: string | null;
  href: string;
  cta: string;
  tone: 'warning' | 'danger' | 'neutral';
};

export type ClientActivityItem = {
  id: string;
  title: string;
  at: string;
};

export type ClientMetric =
  | { key: string; label: string; kind: 'number'; value: number }
  | { key: string; label: string; kind: 'text'; value: string }
  | { key: string; label: string; kind: 'money'; value: number; currency: string };

export type ClientFinanceSummary = {
  invoiced: number;
  paid: number;
  remaining: number;
  overdue: number;
  currency: string;
  hasInvoices: boolean;
};

export type ClientProfileSafe = {
  id: string;
  name: string;
  logoUrl: string | null;
  colorHex: string | null;
  currency: string;
  monthlyVideoQuota: number;
};

export type ClientWorkspaceOverview = {
  profile: ClientProfileSafe;
  metrics: ClientMetric[];
  attention: ClientAttentionItem[];
  activeProjects: ClientSafeProject[];
  videos: ClientSafeVideo[];
  upcoming: {
    today: ClientAttentionItem[];
    week: ClientAttentionItem[];
    later: ClientAttentionItem[];
  };
  finance: ClientFinanceSummary;
  recentInvoices: ClientSafeInvoice[];
  activity: ClientActivityItem[];
  reportsAvailable: boolean;
};
