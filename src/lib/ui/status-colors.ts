/**
 * Couleurs opérationnelles centralisées (palette + classes Tailwind).
 * L’orange marque #FF3D0A reste pour les CTA — ici on priorise la lecture métier.
 */
import type { TaskPriority, TaskStatus, VideoPublicStatus, VideoStatus } from '@/types/database';
import {
  getClientDeliveryScheduleState,
  getShootingScheduleState,
  type ClientDeliveryScheduleState,
  type ShootingScheduleState,
} from '@/lib/deadlines/deadline-state';
import { effectiveClientDeliveryIso, isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';

export const OPERATIONAL = {
  danger: '#EF4444',
  urgent: '#F97316',
  waitClient: '#F59E0B',
  shoot: '#3B82F6',
  postProd: '#8B5CF6',
  success: '#22C55E',
  muted: '#6B7280',
  supra: '#FF3D0A',
} as const;

export type OperationalColorKey =
  | 'danger'
  | 'urgent'
  | 'waitClient'
  | 'shoot'
  | 'postProd'
  | 'success'
  | 'muted'
  | 'neutral';

/** Badge compact (fond + texte lisible clair/sombre). */
export function operationalBadgeClass(key: OperationalColorKey): string {
  switch (key) {
    case 'danger':
      return 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300';
    case 'urgent':
      return 'border-orange-500/40 bg-orange-500/15 text-orange-800 dark:text-orange-300';
    case 'waitClient':
      return 'border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-200';
    case 'shoot':
      return 'border-blue-500/40 bg-blue-500/12 text-blue-900 dark:text-blue-200';
    case 'postProd':
      return 'border-violet-500/40 bg-violet-500/12 text-violet-900 dark:text-violet-200';
    case 'success':
      return 'border-emerald-500/40 bg-emerald-500/12 text-emerald-900 dark:text-emerald-200';
    case 'muted':
      return 'border-muted-foreground/30 bg-muted/50 text-muted-foreground';
    case 'neutral':
      return 'border-border/60 bg-muted/25 text-foreground';
    default:
      return 'border-border/60 bg-muted/30 text-foreground';
  }
}

function shootingStateToKey(state: ShootingScheduleState): OperationalColorKey {
  switch (state) {
    case 'unplanned':
      return 'muted';
    case 'planned_far':
    case 'planned_week':
      return 'shoot';
    case 'soon_3d':
      return 'shoot';
    case 'tomorrow':
      return 'urgent';
    case 'today':
      return 'urgent';
    case 'overdue':
      return 'danger';
    case 'in_progress':
      return 'shoot';
    case 'done_field':
      return 'success';
    case 'done_post':
      return 'postProd';
    default:
      return 'neutral';
  }
}

function deliveryStateToKey(state: ClientDeliveryScheduleState): OperationalColorKey {
  switch (state) {
    case 'unplanned':
      return 'muted';
    case 'far':
      return 'neutral';
    case 'prepare_week':
      return 'waitClient';
    case 'soon_48h':
      return 'urgent';
    case 'tomorrow':
      return 'urgent';
    case 'today':
      return 'danger';
    case 'overdue':
      return 'danger';
    case 'delivered':
      return 'success';
    default:
      return 'neutral';
  }
}

export function getShootingBadge(
  shootingIso: string | null | undefined,
  videoStatus: VideoStatus,
  now?: Date,
): { label: string; colorKey: OperationalColorKey; className: string } {
  const { state, label } = getShootingScheduleState(shootingIso, videoStatus, now);
  const colorKey = shootingStateToKey(state);
  return { label, colorKey, className: operationalBadgeClass(colorKey) };
}

export function getClientDeliveryBadge(
  video: {
    client_delivery_at?: string | null;
    delivery_deadline?: string | null;
    status: VideoStatus;
    public_status?: VideoPublicStatus;
  },
  now?: Date,
): { label: string; colorKey: OperationalColorKey; className: string } {
  const iso = effectiveClientDeliveryIso(video);
  const { state, label } = getClientDeliveryScheduleState(video, iso, now);
  const colorKey = deliveryStateToKey(state);
  return { label, colorKey, className: operationalBadgeClass(colorKey) };
}

/**
 * Couleur dominante statut production vidéo (7 familles demandées).
 */
export function getVideoProductionColorKey(
  status: VideoStatus,
  publicStatus: VideoPublicStatus,
  opts?: {
    deliveryOverdue?: boolean;
    video?: {
      client_delivery_at?: string | null;
      delivery_deadline?: string | null;
    };
  },
): OperationalColorKey {
  const od =
    opts?.deliveryOverdue ??
    (opts?.video
      ? isVideoDeliveryOverdue({
          status,
          public_status: publicStatus,
          client_delivery_at: opts.video.client_delivery_at ?? null,
          delivery_deadline: opts.video.delivery_deadline ?? null,
        })
      : false);
  if (od) return 'danger';
  if (status === 'published' || status === 'validated') return 'success';
  if (status === 'archived' || status === 'cancelled') return 'muted';
  if (status === 'idea' || status === 'brief_pending') return 'muted';
  if (status === 'shooting_planned' || status === 'shooting_in_progress') return 'shoot';
  if (status === 'shooting_done' || status === 'rushes_received') return 'shoot';
  if (status === 'editing' || status === 'internal_review') return 'postProd';
  if (status === 'sent_to_client' || publicStatus === 'in_validation') return 'waitClient';
  if (status === 'client_revision' || publicStatus === 'revision_requested') return 'urgent';
  if (status === 'brief_validated') return 'neutral';
  return 'neutral';
}

export function getVideoProductionBadgeClass(
  status: VideoStatus,
  publicStatus: VideoPublicStatus,
  opts?: { deliveryOverdue?: boolean; video?: { client_delivery_at?: string | null; delivery_deadline?: string | null } },
): string {
  return operationalBadgeClass(getVideoProductionColorKey(status, publicStatus, opts));
}

export function getVideoPublicPortalColorKey(publicStatus: VideoPublicStatus): OperationalColorKey {
  switch (publicStatus) {
    case 'topic_proposed':
      return 'muted';
    case 'brief_validated':
    case 'shooting_planned':
      return 'shoot';
    case 'in_production':
      return 'shoot';
    case 'in_editing':
      return 'postProd';
    case 'in_validation':
      return 'waitClient';
    case 'revision_requested':
      return 'urgent';
    case 'validated':
    case 'published':
      return 'success';
    default:
      return 'neutral';
  }
}

export function getVideoPublicBadgeClass(publicStatus: VideoPublicStatus): string {
  return operationalBadgeClass(getVideoPublicPortalColorKey(publicStatus));
}

export function getTaskStatusColorKey(status: TaskStatus): OperationalColorKey {
  switch (status) {
    case 'todo':
      return 'muted';
    case 'in_progress':
      return 'shoot';
    case 'waiting_client':
      return 'waitClient';
    case 'waiting_team':
      return 'urgent';
    case 'review':
      return 'postProd';
    case 'done':
      return 'success';
    case 'blocked':
      return 'danger';
    case 'archived':
      return 'muted';
    default:
      return 'neutral';
  }
}

export function getTaskPriorityColorKey(priority: TaskPriority): OperationalColorKey {
  switch (priority) {
    case 'low':
      return 'muted';
    case 'normal':
      return 'neutral';
    case 'high':
      return 'urgent';
    case 'urgent':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getTaskStatusBadgeClass(status: TaskStatus): string {
  return operationalBadgeClass(getTaskStatusColorKey(status));
}

export function getTaskPriorityBadgeClass(priority: TaskPriority): string {
  return operationalBadgeClass(getTaskPriorityColorKey(priority));
}

export type CalendarEventKind =
  | 'task'
  | 'video_shoot'
  | 'video_delivery'
  | 'validation'
  | 'invoice'
  | 'roadmap'
  | 'internal';

export function getCalendarEventColorKey(kind: CalendarEventKind, opts?: { overdue?: boolean }): OperationalColorKey {
  if (opts?.overdue && kind !== 'task') return 'danger';
  switch (kind) {
    case 'video_shoot':
      return 'shoot';
    case 'video_delivery':
      return opts?.overdue ? 'danger' : 'urgent';
    case 'validation':
      return 'waitClient';
    case 'invoice':
      return opts?.overdue ? 'danger' : 'success';
    case 'roadmap':
      return 'postProd';
    case 'internal':
      return 'muted';
    case 'task':
    default:
      return 'neutral';
  }
}

/** Puce calendrier (Tailwind) pour type événement vidéo interne. */
export function getCalendarVideoDotClass(
  kind: 'shoot' | 'delivery',
  video: {
    status: VideoStatus;
    public_status: VideoPublicStatus;
    shooting_date?: string | null;
    client_delivery_at?: string | null;
    delivery_deadline?: string | null;
  },
  atIso: string,
  now: Date = new Date(),
): string {
  if (kind === 'shoot') {
    const { state } = getShootingScheduleState(video.shooting_date ?? atIso, video.status, now);
    const k = shootingStateToKey(state);
    if (k === 'danger') return 'bg-red-500';
    if (k === 'urgent') return 'bg-orange-500';
    if (k === 'shoot') return 'bg-blue-500';
    if (k === 'success' || k === 'postProd') return 'bg-emerald-500';
    return 'bg-slate-400';
  }
  const del = effectiveClientDeliveryIso(video);
  const { state } = getClientDeliveryScheduleState(
    {
      client_delivery_at: video.client_delivery_at ?? null,
      delivery_deadline: video.delivery_deadline ?? null,
      status: video.status,
      public_status: video.public_status,
    },
    del,
    now,
  );
  const k = deliveryStateToKey(state);
  if (k === 'danger') return 'bg-red-500';
  if (k === 'urgent' || k === 'waitClient') return 'bg-orange-500';
  if (k === 'success') return 'bg-emerald-500';
  return 'bg-orange-400/90';
}

export function getCalendarVideoChipSurface(
  kind: 'shoot' | 'delivery',
  video: { status: VideoStatus; public_status: VideoPublicStatus; shooting_date?: string | null; client_delivery_at?: string | null; delivery_deadline?: string | null },
  atIso: string,
  now: Date = new Date(),
): { border: string; bg: string } {
  if (kind === 'shoot') {
    const st = getShootingScheduleState(video.shooting_date ?? atIso, video.status, now).state;
    if (st === 'in_progress') {
      return {
        border: 'border-l-[#FF6A2A] border-orange-500/40',
        bg: 'bg-orange-500/[0.12] dark:bg-orange-500/[0.16]',
      };
    }
    if (st === 'overdue') {
      return {
        border: 'border-l-red-500 border-red-500/35',
        bg: 'bg-red-500/[0.1] dark:bg-red-500/[0.14]',
      };
    }
    if (st === 'today' || st === 'tomorrow') {
      return {
        border: 'border-l-orange-500 border-orange-500/35',
        bg: 'bg-orange-500/[0.1] dark:bg-orange-500/[0.14]',
      };
    }
    return {
      border: 'border-l-blue-500 border-blue-500/35',
      bg: 'bg-blue-500/[0.1] dark:bg-blue-500/[0.14]',
    };
  }
  const del = effectiveClientDeliveryIso(video);
  const dSt = getClientDeliveryScheduleState(
    {
      client_delivery_at: video.client_delivery_at ?? null,
      delivery_deadline: video.delivery_deadline ?? null,
      status: video.status,
      public_status: video.public_status,
    },
    del,
    now,
  ).state;
  if (dSt === 'overdue' || dSt === 'today') {
    return {
      border: 'border-l-red-500 border-red-500/35',
      bg: 'bg-red-500/[0.08] dark:bg-red-500/[0.12]',
    };
  }
  if (dSt === 'tomorrow' || dSt === 'soon_48h' || dSt === 'prepare_week') {
    return {
      border: 'border-l-orange-500 border-orange-500/35',
      bg: 'bg-orange-500/[0.1] dark:bg-orange-500/[0.14]',
    };
  }
  if (dSt === 'delivered') {
    return {
      border: 'border-l-emerald-500 border-emerald-500/35',
      bg: 'bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12]',
    };
  }
  return {
    border: 'border-l-orange-400 border-orange-400/30',
    bg: 'bg-orange-500/[0.06] dark:bg-orange-500/[0.1]',
  };
}
