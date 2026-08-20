/**
 * Video display metadata — labels/colors copied from the web app
 * (src/types/domain.ts VIDEO_STATUS_MAP) for visual consistency.
 */
import type { VideoFormat, VideoPublicStatus, VideoStatus } from '@/types/db';
import type { BadgeConfig } from '@/lib/task-meta';

export const VIDEO_STATUS_MAP: Record<VideoStatus, BadgeConfig> = {
  idea: { label: 'Idée', color: '#525252' },
  brief_pending: { label: 'Brief à préparer', color: '#8B8B8B' },
  brief_validated: { label: 'Brief validé', color: '#7C8DB0' },
  shooting_planned: { label: 'Tournage planifié', color: '#D14A28' },
  shooting_in_progress: { label: 'Tournage en cours', color: '#FF6A2A' },
  shooting_done: { label: 'Tournage terminé', color: '#FF450F' },
  rushes_received: { label: 'Rushes reçus', color: '#C4789B' },
  editing: { label: 'Montage en cours', color: '#6B9E7A' },
  internal_review: { label: 'Révision interne', color: '#7C8DB0' },
  sent_to_client: { label: 'Envoyé client', color: '#C4789B' },
  client_revision: { label: 'Révision client', color: '#E07B3A' },
  validated: { label: 'Validé', color: '#6B9E7A' },
  published: { label: 'Publié', color: '#3DBD7D' },
  archived: { label: 'Archivé', color: '#525252' },
  cancelled: { label: 'Annulé', color: '#E05252' },
};

export const VIDEO_FORMAT_LABELS: Record<VideoFormat, string> = {
  reel: 'Reel',
  story: 'Story',
  tiktok: 'TikTok',
  short: 'Short',
  long_form: 'Format long',
  ad: 'Publicité',
  showcase: 'Vitrine',
};

/**
 * Effective client delivery date — same rule as the web's
 * effectiveClientDeliveryIso (src/lib/alerts/video-alert-rules.ts):
 * client_delivery_at wins; legacy date-only delivery_deadline → noon UTC.
 */
export function effectiveClientDeliveryIso(video: {
  client_delivery_at: string | null;
  delivery_deadline: string | null;
}): string | null {
  if (video.client_delivery_at) return video.client_delivery_at;
  const d = video.delivery_deadline;
  if (!d) return null;
  return d.length <= 10 ? `${d}T12:00:00.000Z` : d;
}

const VIDEO_RESOLVED_STATUSES: readonly VideoStatus[] = [
  'validated',
  'published',
  'archived',
  'cancelled',
];

/**
 * Overdue delivery — same rule as the web's isVideoDeliveryOverdueActive
 * (src/lib/alerts/video-alert-rules.ts): resolved videos (status or
 * public_status validated/published) are never overdue.
 */
export function isVideoDeliveryOverdue(video: {
  status: VideoStatus;
  public_status: VideoPublicStatus | null;
  client_delivery_at: string | null;
  delivery_deadline: string | null;
}): boolean {
  if (VIDEO_RESOLVED_STATUSES.includes(video.status)) return false;
  if (video.public_status === 'validated' || video.public_status === 'published') return false;
  const iso = effectiveClientDeliveryIso(video);
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}
