/**
 * Libellés client — miroir EXACT du web (src/types/domain.ts
 * VIDEO_PUBLIC_STATUS_MAP + src/lib/clients/client-labels.ts).
 *
 * Le client ne voit JAMAIS `videos.status` (statut interne) : seul
 * `public_status` est exposé, et les RPC `portal_my_*` ne renvoient même pas
 * le statut interne.
 */
import type { BadgeConfig } from '@/lib/task-meta';

export type VideoPublicStatus =
  | 'topic_proposed'
  | 'brief_validated'
  | 'shooting_planned'
  | 'in_production'
  | 'in_editing'
  | 'in_validation'
  | 'revision_requested'
  | 'validated'
  | 'published';

export type ProjectStatus =
  | 'todo'
  | 'in_progress'
  | 'waiting_content'
  | 'waiting_client'
  | 'review'
  | 'validated'
  | 'delivered'
  | 'archived';

/** Copie de VIDEO_PUBLIC_STATUS_MAP (web). */
export const VIDEO_PUBLIC_STATUS_MAP: Record<VideoPublicStatus, BadgeConfig> = {
  topic_proposed: { label: 'Sujet proposé', color: '#525252' },
  brief_validated: { label: 'Brief validé', color: '#7C8DB0' },
  shooting_planned: { label: 'Tournage planifié', color: '#D14A28' },
  in_production: { label: 'En production', color: '#FF450F' },
  in_editing: { label: 'En montage', color: '#6B9E7A' },
  in_validation: { label: 'En validation', color: '#C4789B' },
  revision_requested: { label: 'Modification demandée', color: '#E07B3A' },
  validated: { label: 'Validé', color: '#6B9E7A' },
  published: { label: 'Publié', color: '#3DBD7D' },
};

export function videoPublicStatusBadge(status: string): BadgeConfig {
  return (
    VIDEO_PUBLIC_STATUS_MAP[status as VideoPublicStatus] ?? {
      label: 'En cours',
      color: '#7C8DB0',
    }
  );
}

/** Phase projet côté client — copie de clientProjectPhase (web). */
export type ClientProjectPhase =
  | 'preparation'
  | 'in_progress'
  | 'production'
  | 'validation'
  | 'delivered'
  | 'paused'
  | 'archived';

const PHASE_LABEL: Record<ClientProjectPhase, string> = {
  preparation: 'En préparation',
  in_progress: 'En cours',
  production: 'En production',
  validation: 'En validation',
  delivered: 'Livré',
  paused: 'En pause',
  archived: 'Archivé',
};

const PHASE_COLOR: Record<ClientProjectPhase, string> = {
  preparation: '#7C8DB0',
  in_progress: '#FF450F',
  production: '#D14A28',
  validation: '#C4789B',
  delivered: '#3DBD7D',
  paused: '#8B8B8B',
  archived: '#525252',
};

function isVideoProjectType(type: string | null | undefined): boolean {
  const t = (type ?? '').toLowerCase();
  return (
    t.includes('video') || t.includes('vidéo') || t.includes('contenu') || t.includes('reels')
  );
}

export function clientProjectPhase(
  status: string,
  type?: string | null,
): ClientProjectPhase {
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

export function clientProjectBadge(status: string, type?: string | null): BadgeConfig {
  const phase = clientProjectPhase(status, type);
  return { label: PHASE_LABEL[phase], color: PHASE_COLOR[phase] };
}

/** Projet « actif » côté client — copie de isActiveClientProject (web). */
export function isActiveClientProject(status: string): boolean {
  return status !== 'archived' && status !== 'delivered';
}

/** Vidéo encore en cours (ni publiée). */
export function isActiveClientVideo(publicStatus: string): boolean {
  return publicStatus !== 'published';
}

/** Vidéo en attente d'action client. */
export function isAwaitingClientValidation(publicStatus: string): boolean {
  return publicStatus === 'in_validation';
}
