/**
 * Dates planification vidéo : livraison client (timestamptz + legacy date).
 */
import {
  effectiveClientDeliveryIso as resolveClientDeliveryIso,
  isVideoDeliveryOverdueActive,
} from '@/lib/alerts/video-alert-rules';

export function effectiveClientDeliveryIso(video: {
  client_delivery_at?: string | null;
  delivery_deadline?: string | null;
}): string | null {
  return resolveClientDeliveryIso(video);
}

export function isVideoDeliveryOverdue(video: {
  client_delivery_at?: string | null;
  delivery_deadline?: string | null;
  status: string;
  public_status?: string;
}): boolean {
  return isVideoDeliveryOverdueActive({
    status: video.status,
    public_status: video.public_status,
    client_delivery_at: video.client_delivery_at,
    delivery_deadline: video.delivery_deadline,
  });
}
