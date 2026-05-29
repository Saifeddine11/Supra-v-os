import { z } from 'zod';
import {
  VIDEO_DRAFT_CONFIRM_REPLY,
  VIDEO_DRAFT_CONFIRM_REPLY_INCOMPLETE,
} from '@/lib/ai/supai-copy';

export { VIDEO_DRAFT_CONFIRM_REPLY, VIDEO_DRAFT_CONFIRM_REPLY_INCOMPLETE };

export const AI_VIDEO_DRAFT_PRIORITY = ['low', 'normal', 'high', 'urgent'] as const;

export const AI_VIDEO_PRODUCTION_STATUSES = [
  'idea',
  'brief_pending',
  'brief_validated',
  'shooting_planned',
  'shooting_in_progress',
  'shooting_done',
  'rushes_received',
  'editing',
  'internal_review',
  'sent_to_client',
  'client_revision',
  'validated',
  'published',
  'archived',
  'cancelled',
] as const;

export const AI_VIDEO_PORTAL_STATUSES = [
  'topic_proposed',
  'brief_validated',
  'shooting_planned',
  'in_production',
  'in_editing',
  'in_validation',
  'revision_requested',
  'validated',
  'published',
] as const;

function nullishOptionalString(maxLen: number) {
  return z.preprocess(
    (v) => {
      if (v === null || v === undefined) return undefined;
      const s = String(v).trim();
      return s.length ? s : undefined;
    },
    z.string().max(maxLen).optional(),
  );
}

export const aiVideoDraftPayloadSchema = z.object({
  title: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string().min(1).max(160),
  ),
  clientName: nullishOptionalString(160),
  subject: nullishOptionalString(200),
  type: nullishOptionalString(120),
  productionStatus: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? 'idea' : v),
    z.enum(AI_VIDEO_PRODUCTION_STATUSES).optional(),
  ),
  portalStatus: z.preprocess(
    (v) => {
      if (v === null || v === undefined || v === '' || v === 'draft') return 'topic_proposed';
      return v;
    },
    z.enum(AI_VIDEO_PORTAL_STATUSES).optional(),
  ),
  shootingDateText: nullishOptionalString(120),
  shootingDateIso: nullishOptionalString(64),
  clientDeliveryDateText: nullishOptionalString(120),
  clientDeliveryDateIso: nullishOptionalString(64),
  editorName: nullishOptionalString(120),
  cameramanName: nullishOptionalString(120),
  priority: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? 'normal' : v),
    z.enum(AI_VIDEO_DRAFT_PRIORITY).optional(),
  ),
  description: nullishOptionalString(2000),
});

export type AiVideoDraftPayload = z.infer<typeof aiVideoDraftPayloadSchema>;

export const aiCreateVideoInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  clientName: z.string().trim().max(160).optional(),
  clientId: z.string().uuid().optional(),
  subject: z.string().trim().max(200).optional(),
  type: z.string().trim().max(120).optional(),
  shootingDateIso: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Date de tournage invalide.'),
  clientDeliveryDateIso: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Date de livraison invalide.'),
  priority: z.enum(AI_VIDEO_DRAFT_PRIORITY).optional(),
  productionStatus: z.enum(AI_VIDEO_PRODUCTION_STATUSES).optional(),
  portalStatus: z.enum(AI_VIDEO_PORTAL_STATUSES).optional(),
});

export type AiCreateVideoInput = z.infer<typeof aiCreateVideoInputSchema>;

export const AI_VIDEO_PRIORITY_LABELS: Record<(typeof AI_VIDEO_DRAFT_PRIORITY)[number], string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgent',
};

export const AI_VIDEO_PRODUCTION_LABELS: Record<(typeof AI_VIDEO_PRODUCTION_STATUSES)[number], string> = {
  idea: 'Idée / Brief',
  brief_pending: 'Brief à préparer',
  brief_validated: 'Brief validé',
  shooting_planned: 'Tournage planifié',
  shooting_in_progress: 'Tournage en cours',
  shooting_done: 'Tournage terminé',
  rushes_received: 'Rushes reçus',
  editing: 'Montage',
  internal_review: 'Révision interne',
  sent_to_client: 'Chez l’équipe',
  client_revision: 'Révision client',
  validated: 'Livré',
  published: 'Livré',
  archived: 'Archivé',
  cancelled: 'Annulé',
};
