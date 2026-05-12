import type { VideoStatus } from '@/types/database';
import { VIDEO_KANBAN_COLUMNS } from '@/types/domain';

/** Colonnes où le drop Kanban est autorisé (hors archivé / annulé). */
export const VIDEO_KANBAN_DND_COLUMN_KEYS = VIDEO_KANBAN_COLUMNS.map((c) => c.key) as readonly string[];

export type VideoKanbanDropColumnKey = (typeof VIDEO_KANBAN_COLUMNS)[number]['key'];

/**
 * Résout la colonne Kanban cible : id de colonne, ou colonne d’une carte survolée (même logique que les tâches).
 */
export function resolveVideoKanbanDropColumnKey(
  overId: unknown,
  videos: { id: string; status: VideoStatus }[],
): VideoKanbanDropColumnKey | null {
  if (overId == null || typeof overId !== 'string') return null;
  if (VIDEO_KANBAN_DND_COLUMN_KEYS.includes(overId)) return overId as VideoKanbanDropColumnKey;
  const hit = videos.find((v) => v.id === overId);
  if (!hit) return null;
  const col = VIDEO_KANBAN_COLUMNS.find((c) => c.statuses.includes(hit.status));
  return (col?.key as VideoKanbanDropColumnKey) ?? null;
}

/**
 * Statut `videos.status` après drop sur une colonne : si déjà dans la colonne, inchangé ; sinon 1er statut de la colonne.
 */
export function targetVideoStatusForKanbanColumn(
  columnKey: VideoKanbanDropColumnKey,
  currentStatus: VideoStatus,
): VideoStatus | null {
  const col = VIDEO_KANBAN_COLUMNS.find((c) => c.key === columnKey);
  if (!col) return null;
  if (col.statuses.includes(currentStatus)) return currentStatus;
  return col.statuses[0] ?? null;
}
