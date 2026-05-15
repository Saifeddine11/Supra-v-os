import type { UserRole, VideoStatus } from '@/types/database';
import type { VideoWithClient } from '@/lib/data/videos';

/** Statuts encore « avant montage » (Kanban avant colonne Montage). */
export const SHOOTING_CONFIRM_VIDEO_STATUSES: VideoStatus[] = [
  'idea',
  'brief_pending',
  'brief_validated',
  'shooting_planned',
  'shooting_done',
  'rushes_received',
];

const TERMINAL: VideoStatus[] = ['archived', 'cancelled', 'validated', 'published'];

export const SHOOTING_POSTPONE_REASON_PRESETS = [
  { value: 'client_indisponible', label: 'Client indisponible' },
  { value: 'lieu_indisponible', label: 'Lieu indisponible' },
  { value: 'equipe_indisponible', label: 'Équipe indisponible' },
  { value: 'meteo', label: 'Météo' },
  { value: 'materiel', label: 'Matériel' },
  { value: 'autre', label: 'Autre' },
] as const;

export type ShootingPostponePreset = (typeof SHOOTING_POSTPONE_REASON_PRESETS)[number]['value'];

export function roleSeesShootingConfirmationFlow(role: UserRole | null): boolean {
  return role === 'admin' || role === 'project_manager' || role === 'cameraman';
}

/**
 * L’utilisateur peut répondre à la demande de confirmation (modal / bloc détail).
 * Admin & PM : toutes les vidéos visibles. Cadreur : uniquement si assigné caméraman.
 */
export function viewerCanRespondToShootingConfirmation(
  viewerRole: UserRole | null,
  viewerEmployeeId: string | null | undefined,
  video: Pick<VideoWithClient, 'cameramen' | 'cameraman_id'>,
): boolean {
  if (!viewerRole || !viewerEmployeeId) return false;
  if (viewerRole === 'admin' || viewerRole === 'project_manager') return true;
  if (viewerRole !== 'cameraman') return false;
  if (video.cameraman_id === viewerEmployeeId) return true;
  return video.cameramen.some((c) => c.id === viewerEmployeeId);
}

export function videoNeedsShootingConfirmation(
  video: Pick<
    VideoWithClient,
    'status' | 'shooting_date' | 'shooting_completed_at' | 'id' | 'title'
  >,
  now: Date,
): boolean {
  if (!video.shooting_date) return false;
  if (video.shooting_completed_at != null && video.shooting_completed_at !== '') return false;
  if (TERMINAL.includes(video.status)) return false;
  if (!SHOOTING_CONFIRM_VIDEO_STATUSES.includes(video.status)) return false;
  const sd = new Date(video.shooting_date);
  if (Number.isNaN(sd.getTime())) return false;
  return sd.getTime() <= now.getTime();
}

export function videoShowsShootingConfirmBadge(
  video: VideoWithClient,
  now: Date,
  viewerRole: UserRole | null,
  viewerEmployeeId: string | null | undefined,
): boolean {
  return (
    videoNeedsShootingConfirmation(video, now) &&
    viewerCanRespondToShootingConfirmation(viewerRole, viewerEmployeeId, video)
  );
}

export function labelForPostponePreset(value: string, detail?: string): string {
  const hit = SHOOTING_POSTPONE_REASON_PRESETS.find((p) => p.value === value);
  const base = hit?.label ?? value;
  if (value === 'autre' && detail?.trim()) return detail.trim();
  if (detail?.trim()) return `${base} — ${detail.trim()}`;
  return base;
}
