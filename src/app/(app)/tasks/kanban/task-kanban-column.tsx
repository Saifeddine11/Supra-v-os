'use client';

import { useDroppable } from '@dnd-kit/core';
import type { Client, Employee, TaskStatus, TaskEnriched } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { DraggableTaskCard } from './draggable-task-card';

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
}: {
  status: TaskStatus;
  label: string;
  accentColor: string;
  tasks: TaskEnriched[];
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
  dragEnabled: boolean;
  /** Pendant le drag, remonte la colonne d’origine au-dessus des autres (ordre de peinture flex). */
  stackOnTop: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: !dragEnabled,
  });

  return (
    <div
      className={cn(
        'flex w-[min(100vw-2rem,320px)] shrink-0 flex-col rounded-2xl border bg-card/95 shadow-sm dark:bg-card/90 md:w-[320px]',
        stackOnTop && 'relative z-[100]',
        dragEnabled && isOver
          ? 'border-primary/45 ring-2 ring-primary/20 dark:border-primary/35'
          : 'border-border/70',
      )}
    >
      <div
        className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2.5"
        style={{ borderTopColor: accentColor, borderTopWidth: 3, borderTopStyle: 'solid' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{label}</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex max-h-[min(70vh,760px)] min-h-[148px] flex-1 flex-col gap-2.5 overflow-y-auto rounded-b-2xl p-2.5 transition-colors',
          dragEnabled && isOver && 'bg-primary/[0.07] dark:bg-primary/[0.1]',
        )}
      >
        {tasks.length === 0 ? (
          <div
            className={cn(
              'flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed px-2 py-6 text-center text-xs transition-colors',
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
            />
          ))
        )}
      </div>
    </div>
  );
}
