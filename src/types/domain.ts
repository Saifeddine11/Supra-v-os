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
  DocumentType,
  ReportType,
  ProjectStatus,
  InternalPriority,
  PaymentMethod,
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

/** Libellés livrables — alignés sur l’enum SQL `document_type`. */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  video_final: 'Vidéo (fichier final)',
  video_preview: 'Vidéo (aperçu)',
  mockup: 'Maquette site / UI',
  logo: 'Logo',
  brand_guide: 'Charte & brand guidelines',
  seo_report: 'Rapport SEO',
  invoice_pdf: 'Facture PDF',
  quote_pdf: 'Devis PDF',
  contract: 'Contrat',
  brief: 'Brief',
  rushes: 'Rushes',
  other: 'Autre',
};

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  project: 'Projet',
  video_production: 'Production vidéo',
  seo: 'SEO',
  social_media: 'Réseaux sociaux',
};

export const CLIENT_STATUS_MAP: Record<ClientStatus, StatusConfig> = {
  prospect:   { label: 'Prospect',  color: '#5B8FD4' },
  active:     { label: 'Actif',     color: '#3DBD7D' },
  pause:      { label: 'En pause',  color: '#8B8B8B' },
  terminated: { label: 'Terminé',   color: '#525252' },
};

export const PROJECT_STATUS_MAP: Record<ProjectStatus, StatusConfig> = {
  todo:             { label: 'À planifier',      color: '#525252' },
  in_progress:      { label: 'En cours',         color: '#FF450F' },
  waiting_client:   { label: 'Attente client',   color: '#C4789B' },
  waiting_content:  { label: 'Attente contenu',  color: '#7C8DB0' },
  review:           { label: 'Révision',         color: '#E07B3A' },
  validated:        { label: 'Validé',           color: '#6B9E7A' },
  delivered:        { label: 'Livré',            color: '#3DBD7D' },
  archived:         { label: 'Archivé',          color: '#525252' },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Virement',
  cash: 'Espèces',
  card: 'Carte',
  check: 'Chèque',
  other: 'Autre',
};

export const INTERNAL_PRIORITY_MAP: Record<InternalPriority, StatusConfig> = {
  low:      { label: 'Basse',    color: '#525252' },
  normal:   { label: 'Normale',  color: '#7C8DB0' },
  high:     { label: 'Haute',    color: '#E07B3A' },
  critical: { label: 'Critique', color: '#E05252' },
};

/** Suggested project types for selects (stored as free text in DB). */
export const PROJECT_TYPE_OPTIONS = [
  { value: 'website', label: 'Site web' },
  { value: 'seo', label: 'SEO' },
  { value: 'branding', label: 'Branding' },
  { value: 'automation', label: 'Automatisation' },
  { value: 'ads', label: 'Publicité' },
  { value: 'video', label: 'Vidéo' },
  { value: 'other', label: 'Autre' },
] as const;

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
  finance:           'Finance',
  client:            'Client',
};

/** Rôles assignables à un collaborateur (hors compte portail client). */
export const TEAM_ASSIGNABLE_ROLES: UserRole[] = [
  'admin',
  'project_manager',
  'commercial',
  'finance',
  'editor',
  'cameraman',
  'developer',
  'designer',
  'seo',
  'community_manager',
];

/**
 * Compétences opérationnelles (multi-sélection) — pas de admin / client.
 * Utilisées pour assignation vidéo, filtres équipe, charge ; pas pour RBAC.
 */
export const OPERATIONAL_SKILL_ROLES: UserRole[] = [
  'project_manager',
  'editor',
  'cameraman',
  'developer',
  'designer',
  'seo',
  'community_manager',
  'commercial',
  'finance',
];

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

/** Column order on the task board (client-safe — no server imports). */
export const TASK_KANBAN_STATUSES: TaskStatus[] = [
  'todo',
  'in_progress',
  'waiting_client',
  'waiting_team',
  'review',
  'blocked',
  'done',
];

// ─── PERMISSION HELPERS ─────────────────────────────────────────────────────

export const FINANCIAL_ROLES: UserRole[] = ['admin', 'project_manager', 'commercial', 'finance'];
export const FINANCIAL_WRITE_ROLES: UserRole[] = ['admin', 'commercial', 'finance'];
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
