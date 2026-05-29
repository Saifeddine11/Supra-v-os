'use client';

import { useDroppable } from '@dnd-kit/core';
import type { Client, UserRole } from '@/types/database';
import type { VideoAssignEmployeeRow } from '@/lib/data/employees';
import type { VideoWithClient } from '@/lib/data/videos';
import type { VideoStatus } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { DraggableVideoKanbanCard } from './draggable-video-kanban-card';
import {
  KANBAN_COLUMN_COMPACT_THRESHOLD,
  KANBAN_COLUMN_HEIGHT_CLASS,
  KANBAN_COLUMN_WIDTH_CLASS,
} from '@/lib/ui/kanban-layout';

const TERMINAL: VideoStatus[] = ['archived', 'cancelled'];

export function VideoKanbanColumn({
  columnKey,
  label,
  accentColor,
  statuses,
  videos,
  clients,
  employees,
  canDelete,
  dragEnabled,
  stackOnTop,
  onOpenDetail,
  highlightVideoId,
  scheduleNow,
  viewerRole,
  viewerEmployeeId,
}: {
  columnKey: string;
  label: string;
  accentColor: string;
  statuses: VideoStatus[];
  videos: VideoWithClient[];
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
  canDelete: boolean;
  dragEnabled: boolean;
  stackOnTop: boolean;
  onOpenDetail?: (video: VideoWithClient) => void;
  highlightVideoId?: string | null;
  scheduleNow: Date;
  viewerRole: UserRole | null;
  viewerEmployeeId: string | null;
}) {
  const droppable = columnKey !== 'terminal';
  const { setNodeRef, isOver } = useDroppable({
    id: columnKey,
    disabled: !dragEnabled || !droppable,
  });

  const items = videos.filter((v) => statuses.includes(v.status));
  const compactCards = items.length > KANBAN_COLUMN_COMPACT_THRESHOLD || !dragEnabled;
  const cardDragEnabled = (v: VideoWithClient) =>
    dragEnabled && droppable && !TERMINAL.includes(v.status);

  return (
    <div
      className={cn(
        KANBAN_COLUMN_HEIGHT_CLASS,
        KANBAN_COLUMN_WIDTH_CLASS,
        'flex flex-col overflow-hidden rounded-[20px] border bg-card/95 shadow-sm dark:bg-card/90',
        stackOnTop && 'relative z-[100]',
        dragEnabled && droppable && isOver
          ? 'border-primary/45 ring-2 ring-primary/20 dark:border-primary/35'
          : 'border-border/70',
      )}
    >
      <div
        className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border/60 bg-card/95 px-3 py-2.5 backdrop-blur-sm dark:bg-card/90"
        style={{ borderTopColor: accentColor, borderTopWidth: 3, borderTopStyle: 'solid' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{label}</p>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'kanban-column-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-y-contain p-2.5 transition-colors',
          dragEnabled && droppable && isOver && 'bg-primary/[0.06] dark:bg-primary/[0.09]',
        )}
      >
        {items.length === 0 ? (
          <div
            className={cn(
              'flex min-h-[120px] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed px-2 py-6 text-center text-xs transition-colors',
              dragEnabled && droppable && isOver
                ? 'border-primary/40 bg-primary/[0.04] text-foreground'
                : 'border-border/60 text-muted-foreground',
            )}
          >
            {dragEnabled && droppable ? (
              <>
                <span className="font-medium text-foreground/90">Déposer ici</span>
                <span className="mt-1 text-[11px] text-muted-foreground">Relâchez la carte dans cette colonne</span>
              </>
            ) : (
              'Aucune vidéo'
            )}
          </div>
        ) : (
          items.map((v) => (
            <DraggableVideoKanbanCard
              key={v.id}
              video={v}
              clients={clients}
              employees={employees}
              canDelete={canDelete}
              dragEnabled={cardDragEnabled(v)}
              compact={compactCards}
              onOpenDetail={onOpenDetail}
              highlightVideoId={highlightVideoId}
              scheduleNow={scheduleNow}
              viewerRole={viewerRole}
              viewerEmployeeId={viewerEmployeeId}
            />
          ))
        )}
      </div>
    </div>
  );
}
