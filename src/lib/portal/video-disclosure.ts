/**
 * Règles de divulgation des vidéos côté portail client (données minimales, pas d’équipe interne).
 */

import type { VideoPublicStatus, VideoStatus } from '@/types/database';

/** Statuts publics affichés au client (alignés sur l’enum DB `video_public_status`). */
export const PORTAL_LISTED_PUBLIC_STATUSES: ReadonlySet<VideoPublicStatus> = new Set([
  'topic_proposed',
  'brief_validated',
  'shooting_planned',
  'in_production',
  'in_editing',
  'in_validation',
  'revision_requested',
  'validated',
  'published',
]);

const TERMINAL_INTERNAL: ReadonlySet<VideoStatus> = new Set(['archived', 'cancelled']);

export function isPortalListedVideo(row: {
  status: VideoStatus;
  public_status: VideoPublicStatus;
}): boolean {
  if (TERMINAL_INTERNAL.has(row.status)) return false;
  return PORTAL_LISTED_PUBLIC_STATUSES.has(row.public_status);
}

/**
 * Aperçu / fichier final : uniquement quand le contenu est censé être partagé avec le client.
 */
export function portalVideoExposeMediaUrls(row: {
  status: VideoStatus;
  public_status: VideoPublicStatus;
}): boolean {
  if (row.public_status === 'in_validation' || row.public_status === 'revision_requested') return true;
  if (row.public_status === 'validated' || row.public_status === 'published') return true;
  if (
    row.status === 'sent_to_client' ||
    row.status === 'client_revision' ||
    row.status === 'validated' ||
    row.status === 'published'
  ) {
    return true;
  }
  return false;
}

export function toPortalVideoRow(row: {
  id: string;
  title: string;
  public_status: VideoPublicStatus;
  status: VideoStatus;
  shooting_date: string | null;
  delivery_deadline: string | null;
  client_delivery_at?: string | null;
  publication_date: string | null;
  preview_url: string | null;
  final_url: string | null;
}): {
  id: string;
  title: string;
  public_status: VideoPublicStatus;
  status: VideoStatus;
  shooting_date: string | null;
  delivery_deadline: string | null;
  client_delivery_at: string | null;
  publication_date: string | null;
  preview_url: string | null;
  final_url: string | null;
} {
  const expose = portalVideoExposeMediaUrls(row);
  return {
    id: row.id,
    title: row.title,
    public_status: row.public_status,
    status: row.status,
    shooting_date: row.shooting_date,
    delivery_deadline: row.delivery_deadline,
    client_delivery_at: row.client_delivery_at ?? null,
    publication_date: row.publication_date,
    preview_url: expose ? row.preview_url : null,
    final_url: expose ? row.final_url : null,
  };
}
