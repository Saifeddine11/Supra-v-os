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
import type { Client, Employee, TaskStatus } from '@/types/database';
import type { TaskEnriched } from '@/types/database';
import { TASK_KANBAN_STATUSES, TASK_STATUS_MAP, taskStatusForKanbanBucket } from '@/types/domain';
import { TaskKanbanColumn } from './kanban/task-kanban-column';
import { requestCriticalAlertsRefresh } from '@/lib/alerts/request-critical-alerts-refresh';
import { updateTaskStatusAction } from './actions';
import {
  KANBAN_BOARD_OUTER_CLASS,
  KANBAN_COLUMNS_ROW_CLASS,
  KANBAN_SCROLL_CLASS,
} from '@/lib/ui/kanban-layout';

/** Intra-column reorder : possible plus tard avec @dnd-kit/sortable + champ `position`. */

function resolveDropStatus(overId: unknown, tasks: TaskEnriched[]): TaskStatus | null {
  if (overId == null || typeof overId !== 'string') return null;
  if (TASK_KANBAN_STATUSES.includes(overId as TaskStatus)) return overId as TaskStatus;
  const hitTask = tasks.find((t) => t.id === overId);
  return hitTask ? hitTask.status : null;
}

function subscribeMediaQuery(cb: () => void) {
  const mq = window.matchMedia('(min-width: 768px)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getDesktopMatches(): boolean {
  return window.matchMedia('(min-width: 768px)').matches;
}

/** Glisser-déposer uniquement sur desktop — sur mobile le menu statut suffit. */
function useDesktopDragEnabled(): boolean {
  return useSyncExternalStore(subscribeMediaQuery, getDesktopMatches, () => false);
}

export function TasksKanban({
  tasks,
  clients,
  employees,
  canDelete,
  allowKanbanDrag,
}: {
  tasks: TaskEnriched[];
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
  allowKanbanDrag: boolean;
}) {
  const router = useRouter();
  const isDesktop = useDesktopDragEnabled();
  const dragEnabled = allowKanbanDrag && isDesktop;

  const [localTasks, setLocalTasks] = useState<TaskEnriched[]>(tasks);
  /** Colonne d’origine : élévation du stacking pour que la carte ne passe pas sous les colonnes suivantes (flex paint order). */
  const [activeSourceStatus, setActiveSourceStatus] = useState<TaskStatus | null>(null);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const byStatus = TASK_KANBAN_STATUSES.map((status) => ({
    status,
    label: TASK_STATUS_MAP[status].label,
    color: TASK_STATUS_MAP[status].color,
    items: localTasks.filter((t) => taskStatusForKanbanBucket(t.status) === status),
  }));

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveSourceStatus(null);
      if (!dragEnabled || !over) return;

      const taskId = String(active.id);
      const targetStatus = resolveDropStatus(over.id, localTasks);
      if (!targetStatus) return;

      const task = localTasks.find((t) => t.id === taskId);
      if (!task || task.status === targetStatus) return;

      const prevStatus = task.status;
      setLocalTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)));

      const res = await updateTaskStatusAction(taskId, targetStatus);
      if (!res.ok) {
        setLocalTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status: prevStatus } : t)));
        toast.error(res.error || 'Impossible de déplacer la tâche.');
        return;
      }

      toast.success('Statut mis à jour', { duration: 2000 });
      requestCriticalAlertsRefresh();
      router.refresh();
    },
    [dragEnabled, localTasks, router],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!dragEnabled) return;
      const taskId = String(event.active.id);
      const col = localTasks.find((t) => t.id === taskId)?.status ?? null;
      setActiveSourceStatus(col);
    },
    [dragEnabled, localTasks],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveSourceStatus(null)}
      onDragEnd={handleDragEnd}
    >
      <div className={KANBAN_BOARD_OUTER_CLASS}>
        <div className={KANBAN_SCROLL_CLASS}>
          <div className={KANBAN_COLUMNS_ROW_CLASS}>
            {byStatus.map((col) => (
              <TaskKanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                accentColor={col.color}
                tasks={col.items}
                clients={clients}
                employees={employees}
                canDelete={canDelete}
                dragEnabled={dragEnabled}
                stackOnTop={dragEnabled && activeSourceStatus === col.status}
              />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
