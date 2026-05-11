'use client';

import { useTransition } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Client, Employee, Task, TaskStatus, TaskEnriched } from '@/types/database';
import { TASK_STATUS_MAP, PRIORITY_MAP, TASK_KANBAN_STATUSES } from '@/types/domain';
import { cn } from '@/lib/utils/cn';
import { getStatusBlockSurface, taskToStatusTone } from '@/lib/ui/status-block-tone';
import { getTaskDeadlineState } from '@/lib/deadlines/deadline-state';
import { getTaskPriorityBadgeClass, getTaskStatusBadgeClass, operationalBadgeClass } from '@/lib/ui/status-colors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { TaskFormDialog } from '../task-form-dialog';
import { archiveTaskAction, deleteTaskAction, updateTaskStatusAction } from '../actions';
import { ClientColorDot } from '@/components/shared/client-color-dot';

function overdue(task: Task): boolean {
  if (!task.deadline || task.status === 'done') return false;
  return new Date(task.deadline).getTime() < Date.now();
}

export function DraggableTaskCard({
  task,
  clients,
  employees,
  canDelete,
  dragEnabled,
}: {
  task: TaskEnriched;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
  dragEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const od = overdue(task);
  const tone = taskToStatusTone(task);
  const dlState = getTaskDeadlineState(task.deadline, task.status);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !dragEnabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative max-w-full overflow-hidden rounded-xl border border-border/50 p-3 pl-3.5 shadow-sm',
        od && 'border-destructive/60 ring-1 ring-destructive/25',
        getStatusBlockSurface(tone, { urgentGlow: od || task.priority === 'urgent' }),
        isDragging && 'relative z-[200]',
        isDragging && '!transition-none',
        isDragging &&
          'scale-[1.02] cursor-grabbing opacity-[0.98] shadow-2xl ring-1 ring-primary/25 dark:shadow-black/50 dark:ring-primary/30',
        dragEnabled && !isDragging && 'cursor-grab active:cursor-grabbing',
      )}
    >
      {task.client_brand_hex ? (
        <span
          className="pointer-events-none absolute bottom-2.5 left-1 top-2.5 w-[3px] rounded-full opacity-95"
          style={{ backgroundColor: task.client_brand_hex }}
          aria-hidden
        />
      ) : null}
      <div
        className={cn(dragEnabled && 'touch-none select-none')}
        {...(dragEnabled ? { ...listeners, ...attributes } : {})}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">{task.title}</p>
          <Badge
            variant="outline"
            className="shrink-0 border-border text-[10px]"
            style={{ color: PRIORITY_MAP[task.priority].color }}
          >
            {PRIORITY_MAP[task.priority].label}
          </Badge>
        </div>
        {task.client_name ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {task.client_brand_hex ? (
              <ClientColorDot hex={task.client_brand_hex} size="sm" title={task.client_name} />
            ) : null}
            <span>{task.client_name}</span>
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {od ? (
            <span
              className={cn(
                'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                operationalBadgeClass('danger'),
              )}
            >
              En retard
            </span>
          ) : null}
          {task.priority === 'urgent' && task.status !== 'done' ? (
            <span
              className={cn(
                'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                operationalBadgeClass('danger'),
              )}
            >
              Urgent
            </span>
          ) : null}
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 text-[10px] font-medium',
              getTaskStatusBadgeClass(task.status),
            )}
          >
            {TASK_STATUS_MAP[task.status].label}
          </span>
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 text-[10px] font-medium',
              getTaskPriorityBadgeClass(task.priority),
            )}
          >
            {PRIORITY_MAP[task.priority].label}
          </span>
          {task.video_id ? (
            <Badge
              variant="outline"
              className="shrink-0 border-primary/35 text-[10px] font-medium text-primary"
            >
              Vidéo
            </Badge>
          ) : null}
          {task.assignees?.length ? (
            <>
              {task.assignees.slice(0, 3).map((p) => (
                <Badge
                  key={p.id}
                  variant="outline"
                  className="max-w-[7.5rem] shrink-0 truncate border-border/80 text-[10px] font-normal"
                  title={p.full_name}
                >
                  {p.full_name.split(/\s+/)[0] ?? p.full_name}
                </Badge>
              ))}
              {task.assignees.length > 3 ? (
                <span className="text-[10px] text-muted-foreground">+{task.assignees.length - 3}</span>
              ) : null}
            </>
          ) : (
            <span className="text-xs italic text-muted-foreground">Non assigné</span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {task.deadline ? (
            <span
              className={cn(
                'tabular-nums',
                od && 'font-semibold text-destructive',
                dlState === 'today' && !od && 'font-medium text-orange-600 dark:text-orange-400',
                dlState === 'tomorrow' && !od && 'font-medium text-amber-700 dark:text-amber-400',
              )}
            >
              {format(new Date(task.deadline), 'd MMM · HH:mm', { locale: fr })}
            </span>
          ) : (
            <span>Pas d&apos;échéance</span>
          )}
          {task.video_id ? (
            <Button variant="link" className="h-auto p-0 text-xs font-medium text-primary" asChild>
              <Link href="/videos">Ouvrir la vidéo</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <div
        className="mt-3 flex flex-wrap gap-1 border-t border-border/60 pt-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <select
          className="h-8 max-w-[140px] flex-1 rounded-md border border-border bg-muted px-2 text-xs text-foreground"
          value={task.status}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as TaskStatus;
            startTransition(async () => {
              await updateTaskStatusAction(task.id, next);
              router.refresh();
            });
          }}
        >
          {TASK_KANBAN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_MAP[s].label}
            </option>
          ))}
        </select>
        <TaskFormDialog
          task={task}
          clients={clients}
          employees={employees}
          trigger={
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
              Éditer
            </Button>
          }
        />
        {canDelete ? (
          <>
            <ConfirmDialog
              title="Archiver cette tâche ?"
              description="Elle disparaîtra du tableau (statut archivé)."
              confirmLabel="Archiver"
              onConfirm={() =>
                startTransition(async () => {
                  await archiveTaskAction(task.id);
                  router.refresh();
                })
              }
            >
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-orange-300">
                Archiver
              </Button>
            </ConfirmDialog>
            <ConfirmDialog
              title="Supprimer définitivement ?"
              description="Action irréversible."
              confirmLabel="Supprimer"
              onConfirm={() =>
                startTransition(async () => {
                  await deleteTaskAction(task.id);
                  router.refresh();
                })
              }
            >
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive">
                Suppr.
              </Button>
            </ConfirmDialog>
          </>
        ) : null}
      </div>
    </article>
  );
}
