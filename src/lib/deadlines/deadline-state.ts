/**
 * États opérationnels pour dates de tournage / livraison / échéances tâches.
 * Logique pure (tests faciles) — pas de dépendance UI.
 */
import {
  addDays,
  differenceInCalendarDays,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { TaskStatus, VideoPublicStatus, VideoStatus } from '@/types/database';
import { isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';

export type ShootingScheduleState =
  | 'unplanned'
  | 'planned_far'
  | 'planned_week'
  | 'soon_3d'
  | 'tomorrow'
  | 'today'
  | 'overdue'
  | 'in_progress'
  | 'done_field'
  | 'done_post';

export type ClientDeliveryScheduleState =
  | 'unplanned'
  | 'far'
  | 'prepare_week'
  | 'soon_48h'
  | 'tomorrow'
  | 'today'
  | 'overdue'
  | 'delivered';

export type TaskDeadlineState = 'none' | 'active' | 'today' | 'tomorrow' | 'soon' | 'overdue';

function day(iso: string | null | undefined, now: Date): Date | null {
  if (!iso) return null;
  const d = parseISO(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return isValid(d) ? startOfDay(d) : null;
}

const POST_SHOOT: VideoStatus[] = [
  'shooting_done',
  'rushes_received',
  'editing',
  'internal_review',
  'sent_to_client',
  'client_revision',
  'validated',
  'published',
];

const TERMINAL: VideoStatus[] = ['archived', 'cancelled', 'published', 'validated'];

/** Statut vidéo : la phase terrain est considérée comme effectuée. */
function shootingCompletedByStatus(status: VideoStatus): boolean {
  if (TERMINAL.includes(status)) return true;
  return POST_SHOOT.includes(status);
}

/**
 * Règles tournage (shooting_date) — bleu terrain, ne pas confondre avec livraison.
 */
export function getShootingScheduleState(
  shootingIso: string | null | undefined,
  videoStatus: VideoStatus,
  now: Date = new Date(),
): { state: ShootingScheduleState; label: string } {
  if (!shootingIso) {
    return { state: 'unplanned', label: 'Tournage non planifié' };
  }
  const shootDay = day(shootingIso, now);
  const today = startOfDay(now);
  if (!shootDay) {
    return { state: 'unplanned', label: 'Tournage non planifié' };
  }

  if (videoStatus === 'shooting_in_progress') {
    return { state: 'in_progress', label: 'Tournage en cours' };
  }

  if (shootingCompletedByStatus(videoStatus)) {
    const post = ['editing', 'internal_review', 'sent_to_client', 'client_revision'].includes(videoStatus);
    return {
      state: post ? 'done_post' : 'done_field',
      label: post ? 'Tournage effectué (post-prod.)' : 'Tournage effectué',
    };
  }

  const diff = differenceInCalendarDays(shootDay, today);
  if (diff < 0) {
    return { state: 'overdue', label: 'Tournage dépassé' };
  }
  if (diff === 0) {
    return { state: 'today', label: 'Tournage aujourd’hui' };
  }
  if (diff === 1) {
    return { state: 'tomorrow', label: 'Tournage demain' };
  }
  if (diff <= 3) {
    return { state: 'soon_3d', label: 'Tournage bientôt' };
  }
  if (diff <= 7) {
    return { state: 'planned_week', label: 'Tournage planifié' };
  }
  return { state: 'planned_far', label: 'Tournage planifié' };
}

/**
 * Règles livraison client (client_delivery_at / delivery_deadline via effective ISO côté appelant).
 */
export function getClientDeliveryScheduleState(
  video: {
    client_delivery_at?: string | null;
    delivery_deadline?: string | null;
    status: VideoStatus;
    public_status?: VideoPublicStatus;
  },
  deliveryIso: string | null,
  now: Date = new Date(),
): { state: ClientDeliveryScheduleState; label: string } {
  const terminal =
    video.status === 'published' ||
    video.status === 'validated' ||
    video.public_status === 'published' ||
    video.public_status === 'validated';
  if (terminal) {
    return { state: 'delivered', label: 'Livrée' };
  }

  if (!deliveryIso) {
    return { state: 'unplanned', label: 'Livraison non planifiée' };
  }

  if (
    isVideoDeliveryOverdue({
      status: video.status,
      public_status: video.public_status ?? 'topic_proposed',
      client_delivery_at: video.client_delivery_at ?? null,
      delivery_deadline: video.delivery_deadline ?? null,
    })
  ) {
    return { state: 'overdue', label: 'Livraison en retard' };
  }

  const dDay = day(deliveryIso, now);
  const today = startOfDay(now);
  if (!dDay) {
    return { state: 'unplanned', label: 'Livraison non planifiée' };
  }

  const diff = differenceInCalendarDays(dDay, today);
  if (diff < 0) {
    return { state: 'overdue', label: 'Livraison en retard' };
  }
  if (diff === 0) {
    return { state: 'today', label: 'Livraison aujourd’hui' };
  }
  if (diff === 1) {
    return { state: 'tomorrow', label: 'Livraison demain' };
  }
  if (diff <= 2) {
    return { state: 'soon_48h', label: 'Livraison bientôt' };
  }
  if (diff <= 7) {
    return { state: 'prepare_week', label: 'À préparer' };
  }
  return { state: 'far', label: 'Livraison planifiée' };
}

/** Fenêtre « dans 48h » à partir de maintenant (horloge), pour alertes fines. */
export function isWithinNextHours(iso: string, hours: number, now: Date = new Date()): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= now.getTime() && t <= now.getTime() + hours * 3600_000;
}

export function getTaskDeadlineState(
  deadline: string | null | undefined,
  status: TaskStatus,
  now: Date = new Date(),
): TaskDeadlineState {
  if (!deadline || status === 'done' || status === 'archived') return 'none';
  const dl = new Date(deadline).getTime();
  if (!Number.isFinite(dl)) return 'none';
  if (dl < now.getTime()) return 'overdue';

  const today = startOfDay(now);
  const dDay = startOfDay(new Date(deadline));
  const diff = differenceInCalendarDays(dDay, today);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 3) return 'soon';
  return 'active';
}

export function isTomorrowCalendar(iso: string, now: Date = new Date()): boolean {
  const d = day(iso, now);
  if (!d) return false;
  return differenceInCalendarDays(d, startOfDay(now)) === 1;
}

export function isTodayCalendar(iso: string, now: Date = new Date()): boolean {
  const d = day(iso, now);
  if (!d) return false;
  return differenceInCalendarDays(d, startOfDay(now)) === 0;
}

/** Début du « demain » calendaire (minuit après aujourd’hui). */
export function tomorrowStart(now: Date = new Date()): Date {
  return startOfDay(addDays(now, 1));
}
