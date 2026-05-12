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
import type { Client } from '@/types/database';
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
}: {
  videos: VideoWithClient[];
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
  canDelete: boolean;
  onOpenDetail?: (video: VideoWithClient) => void;
  highlightVideoId?: string | null;
  allowKanbanDrag: boolean;
  scheduleNow: Date;
}) {
  const router = useRouter();
  const isDesktop = useDesktopDragEnabled();
  const dragEnabled = allowKanbanDrag && isDesktop;

  const [localVideos, setLocalVideos] = useState<VideoWithClient[]>(videos);
  const [activeSourceColumn, setActiveSourceColumn] = useState<VideoKanbanDropColumnKey | 'terminal' | null>(null);

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
      if (!dragEnabled || !over) return;

      const videoId = String(active.id);
      const columnKey = resolveVideoKanbanDropColumnKey(over.id, localVideos);
      if (!columnKey) return;

      const video = localVideos.find((v) => v.id === videoId);
      if (!video) return;

      const nextStatus = targetVideoStatusForKanbanColumn(columnKey as VideoKanbanDropColumnKey, video.status);
      if (!nextStatus || nextStatus === video.status) return;

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
    [dragEnabled, localVideos, router],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!dragEnabled) return;
      const id = String(event.active.id);
      const v = localVideos.find((x) => x.id === id);
      if (!v) return;
      setActiveSourceColumn(columnKeyForVideo(v));
    },
    [columnKeyForVideo, dragEnabled, localVideos],
  );

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
      onDragCancel={() => setActiveSourceColumn(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="relative rounded-2xl border border-border/60 bg-muted/15 p-2 dark:bg-muted/10 md:p-3">
        <p className="mb-3 text-xs text-muted-foreground md:hidden">
          Sur mobile, utilisez le menu de statut sur chaque carte pour changer l’étape.
        </p>
        <div className="overflow-x-auto scroll-smooth pb-2 [-webkit-overflow-scrolling:touch]">
          <div className="flex w-max min-w-full gap-5 pr-1">
            {VIDEO_KANBAN_COLUMNS.map((col) => (
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
                stackOnTop={dragEnabled && activeSourceColumn === col.key}
                onOpenDetail={onOpenDetail}
                highlightVideoId={highlightVideoId}
                scheduleNow={scheduleNow}
              />
            ))}
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
            />
          </div>
        </div>
      </div>
    </DndContext>
  );
}
