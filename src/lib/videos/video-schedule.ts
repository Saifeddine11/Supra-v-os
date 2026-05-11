/**
 * Dates planification vidéo : livraison client (timestamptz + legacy date).
 */
export function effectiveClientDeliveryIso(video: {
  client_delivery_at?: string | null;
  delivery_deadline?: string | null;
}): string | null {
  if (video.client_delivery_at) return video.client_delivery_at;
  const d = video.delivery_deadline;
  if (!d) return null;
  return d.length <= 10 ? `${d}T12:00:00.000Z` : d;
}

export function isVideoDeliveryOverdue(video: {
  client_delivery_at?: string | null;
  delivery_deadline?: string | null;
  status: string;
  public_status?: string;
}): boolean {
  const terminal = new Set(['published', 'validated', 'archived', 'cancelled']);
  if (terminal.has(video.status)) return false;
  const pub = video.public_status;
  if (pub === 'published' || pub === 'validated') return false;
  const iso = effectiveClientDeliveryIso(video);
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}
