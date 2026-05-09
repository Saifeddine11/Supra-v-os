/**
 * ============================================================================
 * DOMAIN TYPES & CONSTANTS
 * ============================================================================
 * Maps DB enums to UI labels, colors, and groupings.
 * Used by status badges, kanban columns, filters, etc.
 * ============================================================================
 */

import type {
  TaskStatus,
  TaskPriority,
  VideoStatus,
  VideoPublicStatus,
  InvoiceStatus,
  QuoteStatus,
  ClientStatus,
  NotificationType,
  UserRole,
} from './database';

// ─── STATUS LABEL/COLOR MAPS ────────────────────────────────────────────────

export interface StatusConfig {
  label: string;
  color: string;
  bgColor?: string;
  description?: string;
}

export const TASK_STATUS_MAP: Record<TaskStatus, StatusConfig> = {
  todo:            { label: 'À faire',          color: '#9CA3AF' },
  in_progress:     { label: 'En cours',         color: '#FF450F' },
  waiting_client:  { label: 'Attente client',   color: '#C4789B' },
  waiting_team:    { label: 'Attente équipe',   color: '#7C8DB0' },
  review:          { label: 'En révision',      color: '#E07B3A' },
  blocked:         { label: 'Bloqué',           color: '#E05252' },
  done:            { label: 'Terminé',          color: '#3DBD7D' },
  archived:        { label: 'Archivé',          color: '#525252' },
};

export const PRIORITY_MAP: Record<TaskPriority, StatusConfig> = {
  low:    { label: 'Basse',   color: '#525252' },
  normal: { label: 'Normale', color: '#7C8DB0' },
  high:   { label: 'Haute',   color: '#E07B3A' },
  urgent: { label: 'Urgent',  color: '#E05252' },
};

export const VIDEO_STATUS_MAP: Record<VideoStatus, StatusConfig> = {
  idea:             { label: 'Idée',                color: '#525252' },
  brief_pending:    { label: 'Brief à préparer',    color: '#8B8B8B' },
  brief_validated:  { label: 'Brief validé',        color: '#7C8DB0' },
  shooting_planned: { label: 'Tournage planifié',   color: '#D14A28' },
  shooting_done:    { label: 'Tournage terminé',    color: '#FF450F' },
  rushes_received:  { label: 'Rushes reçus',        color: '#C4789B' },
  editing:          { label: 'Montage en cours',    color: '#6B9E7A' },
  internal_review:  { label: 'Révision interne',    color: '#7C8DB0' },
  sent_to_client:   { label: 'Envoyé client',       color: '#C4789B' },
  client_revision:  { label: 'Révision client',     color: '#E07B3A' },
  validated:        { label: 'Validé',              color: '#6B9E7A' },
  published:        { label: 'Publié',              color: '#3DBD7D' },
  archived:         { label: 'Archivé',             color: '#525252' },
  cancelled:        { label: 'Annulé',              color: '#E05252' },
};

export const VIDEO_PUBLIC_STATUS_MAP: Record<VideoPublicStatus, StatusConfig> = {
  topic_proposed:     { label: 'Sujet proposé',       color: '#525252' },
  brief_validated:    { label: 'Brief validé',        color: '#7C8DB0' },
  shooting_planned:   { label: 'Tournage planifié',   color: '#D14A28' },
  in_production:      { label: 'En production',       color: '#FF450F' },
  in_editing:         { label: 'En montage',          color: '#6B9E7A' },
  in_validation:      { label: 'En validation',       color: '#C4789B' },
  revision_requested: { label: 'Modification demandée', color: '#E07B3A' },
  validated:          { label: 'Validé',              color: '#6B9E7A' },
  published:          { label: 'Publié',              color: '#3DBD7D' },
};

export const INVOICE_STATUS_MAP: Record<InvoiceStatus, StatusConfig> = {
  draft:     { label: 'Brouillon',  color: '#525252' },
  sent:      { label: 'Envoyée',    color: '#5B8FD4' },
  pending:   { label: 'En attente', color: '#E07B3A' },
  paid:      { label: 'Payée',      color: '#3DBD7D' },
  overdue:   { label: 'En retard',  color: '#E05252' },
  cancelled: { label: 'Annulée',    color: '#525252' },
};

export const QUOTE_STATUS_MAP: Record<QuoteStatus, StatusConfig> = {
  draft:     { label: 'Brouillon', color: '#525252' },
  sent:      { label: 'Envoyé',    color: '#5B8FD4' },
  accepted:  { label: 'Accepté',   color: '#3DBD7D' },
  refused:   { label: 'Refusé',    color: '#E05252' },
  expired:   { label: 'Expiré',    color: '#8B8B8B' },
  converted: { label: 'Converti',  color: '#FF450F' },
};

export const CLIENT_STATUS_MAP: Record<ClientStatus, StatusConfig> = {
  prospect:   { label: 'Prospect',  color: '#5B8FD4' },
  active:     { label: 'Actif',     color: '#3DBD7D' },
  pause:      { label: 'En pause',  color: '#8B8B8B' },
  terminated: { label: 'Terminé',   color: '#525252' },
};

// ─── ROLE LABELS ────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:             'Administrateur',
  project_manager:   'Chef de projet',
  editor:            'Monteur',
  cameraman:         'Caméraman',
  developer:         'Développeur',
  designer:          'Designer',
  seo:               'SEO',
  commercial:        'Commercial',
  community_manager: 'Community Manager',
  client:            'Client',
};

// ─── KANBAN GROUPINGS ───────────────────────────────────────────────────────

/** Groups verbose video statuses into kanban columns for compact UI */
export const VIDEO_KANBAN_COLUMNS: Array<{
  key: string;
  label: string;
  statuses: VideoStatus[];
  color: string;
}> = [
  { key: 'idea',          label: 'Idée / Brief',     statuses: ['idea', 'brief_pending', 'brief_validated'], color: '#7C8DB0' },
  { key: 'shooting',      label: 'Tournage',          statuses: ['shooting_planned', 'shooting_done', 'rushes_received'], color: '#D14A28' },
  { key: 'editing',       label: 'Montage',           statuses: ['editing', 'internal_review'], color: '#6B9E7A' },
  { key: 'client_review', label: 'Chez client',       statuses: ['sent_to_client', 'client_revision'], color: '#C4789B' },
  { key: 'validated',     label: 'Validé',            statuses: ['validated'], color: '#6B9E7A' },
  { key: 'published',     label: 'Publié',            statuses: ['published'], color: '#3DBD7D' },
];

export const TASK_KANBAN_COLUMNS: Array<{
  key: TaskStatus;
  label: string;
  color: string;
}> = [
  { key: 'todo',           label: 'À faire',         color: '#9CA3AF' },
  { key: 'in_progress',    label: 'En cours',        color: '#FF450F' },
  { key: 'review',         label: 'En révision',     color: '#E07B3A' },
  { key: 'waiting_client', label: 'Attente client',  color: '#C4789B' },
  { key: 'blocked',        label: 'Bloqué',          color: '#E05252' },
  { key: 'done',           label: 'Terminé',         color: '#3DBD7D' },
];

// ─── PERMISSION HELPERS ─────────────────────────────────────────────────────

export const FINANCIAL_ROLES: UserRole[] = ['admin', 'project_manager', 'commercial'];
export const FINANCIAL_WRITE_ROLES: UserRole[] = ['admin', 'commercial'];
export const PRODUCTION_ROLES: UserRole[] = ['admin', 'project_manager', 'editor', 'cameraman'];
export const ADMIN_ROLES: UserRole[] = ['admin', 'project_manager'];

export function canAccessFinancials(role: UserRole | null): boolean {
  return role !== null && FINANCIAL_ROLES.includes(role);
}

export function canManageFinancials(role: UserRole | null): boolean {
  return role !== null && FINANCIAL_WRITE_ROLES.includes(role);
}

export function isAdminOrPM(role: UserRole | null): boolean {
  return role !== null && ADMIN_ROLES.includes(role);
}

// ─── WORKLOAD THRESHOLDS ────────────────────────────────────────────────────

export const WORKLOAD = {
  available: { max: 60,  color: '#3DBD7D', label: 'Disponible' },
  optimal:   { max: 80,  color: '#FF6A2A', label: 'Optimal' },
  high:      { max: 100, color: '#E07B3A', label: 'Élevé' },
  overload:  { max: 999, color: '#E05252', label: 'Surchargé' },
} as const;

export function getWorkloadStatus(loadPercent: number) {
  if (loadPercent < WORKLOAD.available.max) return WORKLOAD.available;
  if (loadPercent < WORKLOAD.optimal.max)   return WORKLOAD.optimal;
  if (loadPercent < WORKLOAD.high.max)      return WORKLOAD.high;
  return WORKLOAD.overload;
}

// ─── SECTORS ────────────────────────────────────────────────────────────────

export const SECTORS = [
  'Restaurant',
  'Hôtellerie',
  'Riad',
  'Immobilier',
  'Beauté',
  'Personal Branding',
  'E-commerce',
  'Événementiel',
  'Coaching',
  'Automobile',
  'Mobilier',
  'Lounge Bar',
  'Mode',
  'Santé',
  'Autre',
] as const;
