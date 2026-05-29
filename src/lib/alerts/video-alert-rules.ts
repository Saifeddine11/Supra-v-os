/**
 * Règles vidéo pour alertes actives — sans dépendance circulaire.
 */
import type { VideoPublicStatus, VideoStatus } from '@/types/database';

/** Alias legacy / libellés alternatifs → statuts canoniques. */
const VIDEO_STATUS_ALIASES: Record<string, string> = {
  delivered: 'published',
  livré: 'published',
  livre: 'published',
  publié: 'published',
  publique: 'published',
  validé: 'validated',
  valide: 'validated',
  archivé: 'archived',
  archive: 'archived',
  annulé: 'cancelled',
  annule: 'cancelled',
  canceled: 'cancelled',
  done: 'published',
};

export function normalizeVideoStatusForAlerts(status: VideoStatus | string | null | undefined): string | null {
  if (!status) return null;
  const key = String(status).trim().toLowerCase();
  return VIDEO_STATUS_ALIASES[key] ?? key;
}

export const VIDEO_RESOLVED_STATUSES: readonly VideoStatus[] = [
  'validated',
  'published',
  'archived',
  'cancelled',
];

export const VIDEO_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL = '(archived,cancelled,published,validated)';

export function effectiveClientDeliveryIso(video: {
  client_delivery_at?: string | null;
  delivery_deadline?: string | null;
}): string | null {
  if (video.client_delivery_at) return video.client_delivery_at;
  const d = video.delivery_deadline;
  if (!d) return null;
  return d.length <= 10 ? `${d}T12:00:00.000Z` : d;
}

export function isVideoResolved(
  status: VideoStatus | string | null | undefined,
  publicStatus?: VideoPublicStatus | string | null,
): boolean {
  const normalized = normalizeVideoStatusForAlerts(status);
  if (!normalized) return true;
  if ((VIDEO_RESOLVED_STATUSES as readonly string[]).includes(normalized)) return true;

  const pubNorm = publicStatus ? normalizeVideoStatusForAlerts(publicStatus) : null;
  if (pubNorm === 'published' || pubNorm === 'validated') return true;

  return false;
}

export function isVideoActiveForAlerts(video: {
  status: VideoStatus | string | null | undefined;
  public_status?: VideoPublicStatus | string | null;
}): boolean {
  return !isVideoResolved(video.status, video.public_status);
}

export function isVideoActiveForCriticalAlerts(video: {
  status: VideoStatus | string | null | undefined;
  public_status?: VideoPublicStatus | string | null;
}): boolean {
  return isVideoActiveForAlerts(video);
}

export function isVideoDeliveryOverdueActive(
  video: {
    status: VideoStatus | string | null | undefined;
    public_status?: VideoPublicStatus | string | null;
    client_delivery_at?: string | null;
    delivery_deadline?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (!isVideoActiveForAlerts(video)) return false;
  const iso = effectiveClientDeliveryIso(video);
  if (!iso) return false;
  return new Date(iso).getTime() < now.getTime();
}
