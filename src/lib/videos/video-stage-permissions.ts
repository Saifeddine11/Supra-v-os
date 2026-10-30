import type { TaskDepartment, UserRole, VideoStatus } from '@/types/database';
import { videoStaffProductionStatusSelectOptions, videoStaffProductionStatusSelectValue } from '@/lib/videos/video-staff-status';
import { targetVideoStatusForKanbanColumn, type VideoKanbanDropColumnKey } from '@/lib/videos/video-kanban-dnd';

/**
 * Qui peut déplacer une vidéo dans le pipeline.
 * Le rôle métier (`employees.role`) reste la base.
 * Un superviseur de pôle vidéo peut faire avancer les étapes opérationnelles de son département.
 * Une personne assignée comme monteur peut faire avancer les étapes de montage, même si son rôle est cadreur.
 * Validation client, publication, archivage et annulation restent réservés à l’admin et au chef de projet.
 */

const SHOOTING_STATUSES: readonly VideoStatus[] = [
  'idea',
  'brief_pending',
  'brief_validated',
  'shooting_planned',
  'shooting_in_progress',
  'shooting_done',
  'rushes_received',
];

const OPERATIONAL_STATUSES: readonly VideoStatus[] = [
  ...SHOOTING_STATUSES,
  'editing',
  'internal_review',
  'sent_to_client',
  'client_revision',
];

const VIDEO_DEPARTMENTS: readonly TaskDepartment[] = ['production_video', 'video_distribution'];

export const VIDEO_STAGE_DENIED =
  'Votre rôle ne permet pas de passer la vidéo à cette étape de production.';

export const VIDEO_PUBLICATION_DENIED =
  'La validation client et la publication restent réservées à l’administrateur ou au chef de projet.';

export const VIDEO_ARCHIVE_DENIED =
  'Seuls l’administrateur ou le chef de projet peuvent archiver ou annuler une vidéo depuis le flux.';

const ROLE_DENIED = 'Action non autorisée pour votre rôle.';

export type VideoStageActor = {
  role: UserRole | null;
  employeeId: string | null;
  isDepartmentSupervisor: boolean;
  department: TaskDepartment | null;
};

export type VideoStageAssignment = {
  editorIds: string[];
  cameramanIds: string[];
};

export function videoStageActorFromEmployee(
  role: UserRole | null,
  employee: {
    id: string;
    is_department_supervisor?: boolean | null;
    department?: TaskDepartment | null;
  } | null,
): VideoStageActor {
  return {
    role,
    employeeId: employee?.id ?? null,
    isDepartmentSupervisor: employee?.is_department_supervisor === true || role === 'department_supervisor',
    department: employee?.department ?? null,
  };
}

export function videoStageAssignmentFromVideo(video: {
  editor_id?: string | null;
  cameraman_id?: string | null;
  editors?: { id: string }[] | null;
  cameramen?: { id: string }[] | null;
}): VideoStageAssignment {
  const editorIds = new Set<string>();
  const cameramanIds = new Set<string>();
  if (video.editor_id) editorIds.add(video.editor_id);
  if (video.cameraman_id) cameramanIds.add(video.cameraman_id);
  for (const editor of video.editors ?? []) editorIds.add(editor.id);
  for (const cameraman of video.cameramen ?? []) cameramanIds.add(cameraman.id);
  return { editorIds: [...editorIds], cameramanIds: [...cameramanIds] };
}

function hasId(ids: string[], employeeId: string | null): boolean {
  return Boolean(employeeId && ids.includes(employeeId));
}

function supervisesVideoProduction(actor: VideoStageActor): boolean {
  return actor.isDepartmentSupervisor && actor.department != null && VIDEO_DEPARTMENTS.includes(actor.department);
}

function allowedOperationalStatuses(actor: VideoStageActor, assignment: VideoStageAssignment): Set<VideoStatus> {
  const allowed = new Set<VideoStatus>();
  const role = actor.role;
  const assignedEditor = hasId(assignment.editorIds, actor.employeeId);
  const assignedCameraman = hasId(assignment.cameramanIds, actor.employeeId);

  if (supervisesVideoProduction(actor) || role === 'editor' || role === 'community_manager' || assignedEditor) {
    for (const status of OPERATIONAL_STATUSES) allowed.add(status);
    return allowed;
  }

  if (role === 'cameraman' || assignedCameraman) {
    for (const status of SHOOTING_STATUSES) allowed.add(status);
  }

  return allowed;
}

export function videoStatusTransitionDenial(
  actor: VideoStageActor,
  assignment: VideoStageAssignment,
  next: VideoStatus,
): string | null {
  const role = actor.role;
  if (!role || role === 'client' || role === 'finance') return ROLE_DENIED;
  if (role === 'admin' || role === 'project_manager') return null;
  if (role === 'commercial') return null;
  if (role === 'developer' || role === 'designer' || role === 'seo') return ROLE_DENIED;

  if (allowedOperationalStatuses(actor, assignment).has(next)) return null;
  if (next === 'archived' || next === 'cancelled') return VIDEO_ARCHIVE_DENIED;
  if (next === 'validated' || next === 'published') return VIDEO_PUBLICATION_DENIED;
  return VIDEO_STAGE_DENIED;
}

export function selectableProductionStatuses(
  actor: VideoStageActor,
  assignment: VideoStageAssignment,
  current: VideoStatus,
): Array<{ value: VideoStatus; label: string }> {
  const currentValue = videoStaffProductionStatusSelectValue(current);
  return videoStaffProductionStatusSelectOptions().filter((option) => {
    if (option.value === current || option.value === currentValue) return true;
    return videoStatusTransitionDenial(actor, assignment, option.value) == null;
  });
}

export function videoKanbanColumnDropDenial(
  actor: VideoStageActor,
  assignment: VideoStageAssignment,
  current: VideoStatus,
  columnKey: VideoKanbanDropColumnKey,
): string | null {
  const next = targetVideoStatusForKanbanColumn(columnKey, current);
  if (!next || next === current) return null;
  return videoStatusTransitionDenial(actor, assignment, next);
}
