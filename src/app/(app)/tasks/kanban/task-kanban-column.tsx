'use client';

import { useDroppable } from '@dnd-kit/core';
import type { Client, Employee, TaskStatus, TaskEnriched } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { DraggableTaskCard } from './draggable-task-card';
import { KANBAN_COLUMN_COMPACT_THRESHOLD, KANBAN_COLUMN_HEIGHT_CLASS, KANBAN_COLUMN_WIDTH_CLASS } from './kanban-board';

export function TaskKanbanColumn({
  status,
  label,
  accentColor,
  tasks,
  clients,
  employees,
  canDelete,
  dragEnabled,
  stackOnTop,
  pulseTaskId,
}: {
  status: TaskStatus;
  label: string;
  accentColor: string;
  tasks: TaskEnriched[];
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
  dragEnabled: boolean;
  stackOnTop: boolean;
  pulseTaskId?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: !dragEnabled,
  });

  const compactCards = tasks.length > KANBAN_COLUMN_COMPACT_THRESHOLD || !dragEnabled;

  return (
    <div
      className={cn(
        KANBAN_COLUMN_HEIGHT_CLASS,
        KANBAN_COLUMN_WIDTH_CLASS,
        'flex flex-col overflow-hidden rounded-[20px] border shadow-sm',
        'bg-muted/25 dark:bg-muted/15',
        stackOnTop && 'relative z-[100]',
        dragEnabled && isOver
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
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'kanban-column-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-y-contain p-2.5 transition-colors',
          dragEnabled && isOver && 'bg-primary/[0.06] dark:bg-primary/[0.09]',
        )}
      >
        {tasks.length === 0 ? (
          <div
            className={cn(
              'flex min-h-[120px] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed px-2 py-6 text-center text-xs transition-colors',
              dragEnabled && isOver
                ? 'border-primary/40 bg-primary/[0.04] text-foreground'
                : 'border-border/60 text-muted-foreground',
            )}
          >
            {dragEnabled ? (
              <>
                <span className="font-medium text-foreground/90">Déposer ici</span>
                <span className="mt-1 text-[11px] text-muted-foreground">Relâchez la carte dans cette colonne</span>
              </>
            ) : (
              'Aucune tâche'
            )}
          </div>
        ) : (
          tasks.map((t) => (
            <DraggableTaskCard
              key={t.id}
              task={t}
              clients={clients}
              employees={employees}
              canDelete={canDelete}
              dragEnabled={dragEnabled}
              compact={compactCards}
              pulseHighlight={pulseTaskId === t.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
