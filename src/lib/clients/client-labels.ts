import type {
  InvoiceStatus,
  ProjectStatus,
  VideoPublicStatus,
  VideoStatus,
} from '@/types/database';
import { PROJECT_TYPE_OPTIONS, VIDEO_PUBLIC_STATUS_MAP } from '@/types/domain';
import { portalVideoAllowsClientAction } from '@/lib/portal/validate';

export type ClientProjectPhase =
  | 'preparation'
  | 'in_progress'
  | 'production'
  | 'validation'
  | 'delivered'
  | 'paused'
  | 'archived';

export const CLIENT_PROJECT_PHASE_LABEL: Record<ClientProjectPhase, string> = {
  preparation: 'En préparation',
  in_progress: 'En cours',
  production: 'En production',
  validation: 'En validation',
  delivered: 'Livré',
  paused: 'En pause',
  archived: 'Archivé',
};

export function isVideoProjectType(type: string | null | undefined): boolean {
  const t = (type ?? '').toLowerCase();
  return t.includes('video') || t.includes('vidéo') || t.includes('contenu') || t.includes('reels');
}

export function clientProjectPhase(status: ProjectStatus, type?: string | null): ClientProjectPhase {
  switch (status) {
    case 'todo':
      return 'preparation';
    case 'in_progress':
      return isVideoProjectType(type) ? 'production' : 'in_progress';
    case 'waiting_content':
      return 'paused';
    case 'waiting_client':
    case 'review':
      return 'validation';
    case 'validated':
    case 'delivered':
      return 'delivered';
    case 'archived':
      return 'archived';
    default:
      return 'in_progress';
  }
}

export function clientProjectPhaseLabel(status: ProjectStatus, type?: string | null): string {
  return CLIENT_PROJECT_PHASE_LABEL[clientProjectPhase(status, type)];
}

export function isActiveClientProject(status: ProjectStatus): boolean {
  return status !== 'archived' && status !== 'delivered';
}

export function clientProjectTypeLabel(type: string | null | undefined): string {
  if (!type?.trim()) return 'Projet';
  const hit = PROJECT_TYPE_OPTIONS.find((o) => o.value === type || o.label.toLowerCase() === type.toLowerCase());
  if (hit) return hit.label;
  return type.trim();
}

export type ClientInvoiceTone = 'paid' | 'pending' | 'overdue' | 'hidden';

export function clientInvoiceTone(status: InvoiceStatus): ClientInvoiceTone {
  if (status === 'paid') return 'paid';
  if (status === 'overdue') return 'overdue';
  if (status === 'sent' || status === 'pending') return 'pending';
  return 'hidden';
}

export function clientInvoiceStatusLabel(status: InvoiceStatus): string {
  const tone = clientInvoiceTone(status);
  if (tone === 'paid') return 'Payée';
  if (tone === 'overdue') return 'En retard';
  if (tone === 'pending') return 'En attente';
  return '—';
}

export function isClientVisibleInvoiceStatus(status: InvoiceStatus): boolean {
  return clientInvoiceTone(status) !== 'hidden';
}

export type ClientPipelineColumn = 'to_shoot' | 'editing' | 'to_validate' | 'validated' | 'delivered';

export const CLIENT_PIPELINE_COLUMN_LABEL: Record<ClientPipelineColumn, string> = {
  to_shoot: 'À tourner',
  editing: 'En montage',
  to_validate: 'À valider',
  validated: 'Validé',
  delivered: 'Publié / Livré',
};

export function clientVideoPipelineColumn(
  publicStatus: VideoPublicStatus,
  status?: VideoStatus,
): ClientPipelineColumn {
  if (publicStatus === 'published') return 'delivered';
  if (publicStatus === 'validated') return 'validated';
  if (publicStatus === 'in_validation' || publicStatus === 'revision_requested') return 'to_validate';
  if (publicStatus === 'in_production' || publicStatus === 'in_editing') return 'editing';
  if (status === 'editing' || status === 'internal_review') return 'editing';
  if (status === 'sent_to_client' || status === 'client_revision') return 'to_validate';
  return 'to_shoot';
}

export function clientVideoStatusLabel(publicStatus: VideoPublicStatus): string {
  return VIDEO_PUBLIC_STATUS_MAP[publicStatus]?.label ?? publicStatus;
}

export function videoNeedsClientValidation(row: {
  status: string;
  public_status: string;
}): boolean {
  return portalVideoAllowsClientAction(row);
}

export function firstNameFromFullName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/).filter(Boolean)[0];
  return first || null;
}

export function formatClientDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatClientDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addLocalDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}
