import type { VideoPublicStatus, VideoStatus } from '@/types/database';
import { normalizeVideoStatusForAlerts } from '@/lib/alerts/video-alert-rules';
import {
  VIDEO_DELIVERED_STATUSES,
  VIDEO_DELIVERED_TARGET_STATUS,
  VIDEO_PUBLIC_STATUS_MAP,
  VIDEO_STATUS_MAP,
} from '@/types/domain';

export { VIDEO_DELIVERED_STATUSES, VIDEO_DELIVERED_TARGET_STATUS };

export function isVideoDeliveredStatus(status: VideoStatus | string | null | undefined): boolean {
  if (!status) return false;
  const n = normalizeVideoStatusForAlerts(status);
  return n === 'validated' || n === 'published';
}

export function isVideoDeliveredPublicStatus(status: VideoPublicStatus | string | null | undefined): boolean {
  if (!status) return false;
  const n = normalizeVideoStatusForAlerts(status);
  return n === 'validated' || n === 'published';
}

/** Libellé staff pour `videos.status` — Validé / Publié → Livré. */
export function videoStaffProductionStatusLabel(status: VideoStatus | string | null | undefined): string {
  if (isVideoDeliveredStatus(status)) return 'Livré';
  if (status && status in VIDEO_STATUS_MAP) return VIDEO_STATUS_MAP[status as VideoStatus].label;
  return String(status ?? '—');
}

/** Libellé staff pour `videos.public_status` — ne modifie pas le portail client. */
export function videoStaffPublicStatusLabel(status: VideoPublicStatus | string | null | undefined): string {
  if (isVideoDeliveredPublicStatus(status)) return 'Livré';
  if (status && status in VIDEO_PUBLIC_STATUS_MAP) return VIDEO_PUBLIC_STATUS_MAP[status as VideoPublicStatus].label;
  return String(status ?? '—');
}

/** Valeur `<select>` production : validated → published (option « Livré »). */
export function videoStaffProductionStatusSelectValue(status: VideoStatus): VideoStatus {
  return isVideoDeliveredStatus(status) ? VIDEO_DELIVERED_TARGET_STATUS : status;
}

/** Options statut production staff — une seule entrée « Livré » (valeur interne `published`). */
export function videoStaffProductionStatusSelectOptions(): Array<{ value: VideoStatus; label: string }> {
  return (Object.keys(VIDEO_STATUS_MAP) as VideoStatus[])
    .filter((s) => s !== 'validated')
    .map((s) => ({
      value: s,
      label: s === 'published' ? 'Livré' : VIDEO_STATUS_MAP[s].label,
    }));
}

/** Cartes kanban / détail : un seul badge final au lieu de Validé + Publié. */
export function videoStaffShowsSingleDeliveredBadge(
  status: VideoStatus,
  publicStatus: VideoPublicStatus,
): boolean {
  return isVideoDeliveredStatus(status) || isVideoDeliveredPublicStatus(publicStatus);
}
