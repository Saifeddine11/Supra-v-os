'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Client, TaskDepartment, UserRole } from '@/types/database';
import type { VideoAssignEmployeeRow } from '@/lib/data/employees';
import type { VideoWithClient } from '@/lib/data/videos';
import type { VideoStatus } from '@/types/database';
import { VIDEO_KANBAN_COLUMNS } from '@/types/domain';
import { updateVideoStatusAction } from './actions';
import { VideoKanbanColumn } from './kanban/video-kanban-column';
import {
  resolveVideoKanbanDropColumnKey,
  targetVideoStatusForKanbanColumn,
  type VideoKanbanDropColumnKey,
} from '@/lib/videos/video-kanban-dnd';
import {
  videoKanbanColumnDropDenial,
  videoStageActorFromEmployee,
  videoStageAssignmentFromVideo,
} from '@/lib/videos/video-stage-permissions';
import {
  KANBAN_BOARD_OUTER_CLASS,
  KANBAN_COLUMNS_ROW_CLASS,
  KANBAN_SCROLL_CLASS,
} from '@/lib/ui/kanban-layout';

const TERMINAL: VideoStatus[] = ['archived', 'cancelled'];

function subscribeMediaQuery(cb: () => void) {
  const mq = window.matchMedia('(min-width: 768px)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getDesktopMatches(): boolean {
  return window.matchMedia('(min-width: 768px)').matches;
}

function useDesktopDragEnabled(): boolean {
  return useSyncExternalStore(subscribeMediaQuery, getDesktopMatches, () => false);
}

export function VideosKanban({
  videos,
  clients,
  employees,
  canDelete,
  onOpenDetail,
  highlightVideoId,
  allowKanbanDrag,
  scheduleNow,
  viewerRole,
  viewerEmployeeId,
  viewerIsDepartmentSupervisor = false,
  viewerDepartment = null,
}: {
  videos: VideoWithClient[];
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
  canDelete: boolean;
  onOpenDetail?: (video: VideoWithClient) => void;
  highlightVideoId?: string | null;
  allowKanbanDrag: boolean;
  scheduleNow: Date;
  viewerRole: UserRole | null;
  viewerEmployeeId: string | null;
  viewerIsDepartmentSupervisor?: boolean;
  viewerDepartment?: TaskDepartment | null;
}) {
  const router = useRouter();
  const isDesktop = useDesktopDragEnabled();
  const dragEnabled = allowKanbanDrag && isDesktop;

  const [localVideos, setLocalVideos] = useState<VideoWithClient[]>(videos);
  const [activeSourceColumn, setActiveSourceColumn] = useState<VideoKanbanDropColumnKey | 'terminal' | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const stageActor = videoStageActorFromEmployee(viewerRole, viewerEmployeeId
    ? { id: viewerEmployeeId, is_department_supervisor: viewerIsDepartmentSupervisor, department: viewerDepartment }
    : null);

  useEffect(() => {
    setLocalVideos(videos);
  }, [videos]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const columnKeyForVideo = useCallback((v: VideoWithClient): VideoKanbanDropColumnKey | 'terminal' => {
    const hit = VIDEO_KANBAN_COLUMNS.find((c) => c.statuses.includes(v.status));
    if (hit) return hit.key as VideoKanbanDropColumnKey;
    if (TERMINAL.includes(v.status)) return 'terminal';
    return 'idea';
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveSourceColumn(null);
      setActiveVideoId(null);
      if (!dragEnabled || !over) return;

      const videoId = String(active.id);
      const columnKey = resolveVideoKanbanDropColumnKey(over.id, localVideos);
      if (!columnKey) return;

      const video = localVideos.find((v) => v.id === videoId);
      if (!video) return;

      const nextStatus = targetVideoStatusForKanbanColumn(columnKey as VideoKanbanDropColumnKey, video.status);
      if (!nextStatus || nextStatus === video.status) return;

      const denial = videoKanbanColumnDropDenial(
        stageActor,
        videoStageAssignmentFromVideo(video),
        video.status,
        columnKey,
      );
      if (denial) {
        toast.error(denial);
        return;
      }

      const prevStatus = video.status;
      setLocalVideos((list) => list.map((v) => (v.id === videoId ? { ...v, status: nextStatus } : v)));

      const res = await updateVideoStatusAction(videoId, nextStatus);
      if (!res.ok) {
        setLocalVideos((list) => list.map((v) => (v.id === videoId ? { ...v, status: prevStatus } : v)));
        toast.error(res.error || 'Modification impossible');
        return;
      }

      toast.success('Statut vidéo mis à jour', { duration: 2000 });
      router.refresh();
    },
    [dragEnabled, localVideos, router, stageActor],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!dragEnabled) return;
      const id = String(event.active.id);
      const v = localVideos.find((x) => x.id === id);
      if (!v) return;
      setActiveVideoId(v.id);
      setActiveSourceColumn(columnKeyForVideo(v));
    },
    [columnKeyForVideo, dragEnabled, localVideos],
  );

  const activeVideo = activeVideoId ? localVideos.find((video) => video.id === activeVideoId) ?? null : null;

  const terminalColumn = {
    key: 'terminal' as const,
    label: 'Archivé / Annulé',
    color: '#525252',
    statuses: TERMINAL,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragCancel={() => {
        setActiveSourceColumn(null);
        setActiveVideoId(null);
      }}
      onDragEnd={handleDragEnd}
    >
      <div className={KANBAN_BOARD_OUTER_CLASS}>
        <p className="mb-3 px-1 text-xs text-muted-foreground md:hidden">
          Sur mobile, utilisez le menu de statut sur chaque carte pour changer l’étape.
        </p>
        <div className={KANBAN_SCROLL_CLASS}>
          <div className={KANBAN_COLUMNS_ROW_CLASS}>
            {VIDEO_KANBAN_COLUMNS.map((col) => {
              const dropLockMessage = activeVideo
                ? videoKanbanColumnDropDenial(
                    stageActor,
                    videoStageAssignmentFromVideo(activeVideo),
                    activeVideo.status,
                    col.key,
                  )
                : null;
              return (
              <VideoKanbanColumn
                key={col.key}
                columnKey={col.key}
                label={col.label}
                accentColor={col.color}
                statuses={col.statuses}
                videos={localVideos}
                clients={clients}
                employees={employees}
                canDelete={canDelete}
                dragEnabled={dragEnabled}
                dropLockMessage={dropLockMessage}
                stackOnTop={dragEnabled && activeSourceColumn === col.key}
                onOpenDetail={onOpenDetail}
                highlightVideoId={highlightVideoId}
                scheduleNow={scheduleNow}
                viewerRole={viewerRole}
                viewerEmployeeId={viewerEmployeeId}
                viewerIsDepartmentSupervisor={viewerIsDepartmentSupervisor}
                viewerDepartment={viewerDepartment}
              />
              );
            })}
            <VideoKanbanColumn
              key={terminalColumn.key}
              columnKey={terminalColumn.key}
              label={terminalColumn.label}
              accentColor={terminalColumn.color}
              statuses={terminalColumn.statuses}
              videos={localVideos}
              clients={clients}
              employees={employees}
              canDelete={canDelete}
              dragEnabled={dragEnabled}
              stackOnTop={dragEnabled && activeSourceColumn === 'terminal'}
              onOpenDetail={onOpenDetail}
              highlightVideoId={highlightVideoId}
              scheduleNow={scheduleNow}
              viewerRole={viewerRole}
              viewerEmployeeId={viewerEmployeeId}
              viewerIsDepartmentSupervisor={viewerIsDepartmentSupervisor}
              viewerDepartment={viewerDepartment}
            />
          </div>
        </div>
      </div>
    </DndContext>
  );
}
