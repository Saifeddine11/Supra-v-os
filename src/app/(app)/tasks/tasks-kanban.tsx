'use client';

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { Client, Employee, TaskStatus } from '@/types/database';
import type { TaskEnriched } from '@/types/database';
import { TASK_KANBAN_STATUSES, TASK_STATUS_MAP, taskStatusForKanbanBucket } from '@/types/domain';
import { TaskKanbanColumn } from './kanban/task-kanban-column';
import { TaskDetailDialog } from './kanban/task-detail-dialog';
import { requestCriticalAlertsRefresh } from '@/lib/alerts/request-critical-alerts-refresh';
import { getTaskEnrichedForHighlightAction, updateTaskStatusAction } from './actions';
import { isTaskPausedForAlerts, isTaskResolved } from '@/lib/alerts/active-alert-rules';
import { TASK_HIGHLIGHT_QUERY_PARAM } from '@/lib/tasks/task-deep-link';
import {
  KANBAN_BOARD_OUTER_CLASS,
  KANBAN_COLUMNS_ROW_CLASS,
  KANBAN_SCROLL_CLASS,
} from '@/lib/ui/kanban-layout';

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

function useDesktopDragEnabled(): boolean {
  return useSyncExternalStore(subscribeMediaQuery, getDesktopMatches, () => false);
}

function scrollTaskCardIntoView(taskId: string) {
  const el = document.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
}

type KanbanProps = {
  tasks: TaskEnriched[];
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
  canEdit: boolean;
  canChangeStatus: boolean;
  allowKanbanDrag: boolean;
};

function TasksKanbanBoard({
  tasks,
  clients,
  employees,
  canDelete,
  canEdit,
  canChangeStatus,
  allowKanbanDrag,
  pulseTaskId,
}: KanbanProps & { pulseTaskId: string | null }) {
  const router = useRouter();
  const isDesktop = useDesktopDragEnabled();
  const dragEnabled = allowKanbanDrag && isDesktop;

  const [localTasks, setLocalTasks] = useState<TaskEnriched[]>(tasks);
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
                canEdit={canEdit}
                canChangeStatus={canChangeStatus}
                dragEnabled={dragEnabled}
                stackOnTop={dragEnabled && activeSourceStatus === col.status}
                pulseTaskId={pulseTaskId}
              />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}

function TasksKanbanDeepLink(props: KanbanProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const highlightId = (searchParams.get(TASK_HIGHLIGHT_QUERY_PARAM) ?? '').trim();
  const [pulseTaskId, setPulseTaskId] = useState<string | null>(null);
  const [deepLinkTask, setDeepLinkTask] = useState<TaskEnriched | null>(null);
  const handledRef = useRef('');

  const clearHighlightParam = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete(TASK_HIGHLIGHT_QUERY_PARAM);
    const next = p.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!highlightId) {
      handledRef.current = '';
      setDeepLinkTask(null);
      return;
    }
    if (handledRef.current === highlightId) return;

    let cancelled = false;
    let pulseTimer: number | undefined;

    void (async () => {
      let task = props.tasks.find((t) => t.id === highlightId) ?? null;
      if (!task) {
        const res = await getTaskEnrichedForHighlightAction(highlightId);
        if (res.ok && res.data) task = res.data;
      }

      if (cancelled) return;

      if (!task || isTaskResolved(task.status) || isTaskPausedForAlerts(task.status)) {
        toast.error('Tâche introuvable ou déjà résolue');
        clearHighlightParam();
        return;
      }

      handledRef.current = highlightId;
      setDeepLinkTask(task);
      setPulseTaskId(task.id);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => scrollTaskCardIntoView(task!.id));
      });

      pulseTimer = window.setTimeout(() => setPulseTaskId(null), 3000);
    })();

    return () => {
      cancelled = true;
      if (pulseTimer) window.clearTimeout(pulseTimer);
    };
  }, [highlightId, props.tasks, clearHighlightParam]);

  return (
    <>
      <TasksKanbanBoard {...props} pulseTaskId={pulseTaskId} />
      {deepLinkTask ? (
        <TaskDetailDialog
          task={deepLinkTask}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeepLinkTask(null);
              clearHighlightParam();
            }
          }}
          clients={props.clients}
          employees={props.employees}
          canDelete={props.canDelete}
        />
      ) : null}
    </>
  );
}

export function TasksKanban(props: KanbanProps) {
  return (
    <Suspense fallback={<TasksKanbanBoard {...props} pulseTaskId={null} />}>
      <TasksKanbanDeepLink {...props} />
    </Suspense>
  );
}
