'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Client, Employee, Task, TaskStatus } from '@/types/database';
import { TASK_STATUS_MAP, PRIORITY_MAP, TASK_KANBAN_STATUSES } from '@/types/domain';
import type { TaskEnriched } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { TaskFormDialog } from './task-form-dialog';
import { archiveTaskAction, deleteTaskAction, updateTaskStatusAction } from './actions';

function overdue(task: Task): boolean {
  if (!task.deadline || task.status === 'done') return false;
  return new Date(task.deadline).getTime() < Date.now();
}

function TaskCard({
  task,
  clients,
  employees,
  canDelete,
}: {
  task: TaskEnriched;
  clients: Pick<Client, 'id' | 'name'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const od = overdue(task);

  return (
    <article
      className={cn(
        'rounded-xl border bg-card/90 p-3 shadow-sm transition-colors',
        od
          ? 'border-destructive/40 ring-1 ring-destructive/15'
          : 'border-border/80'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-foreground">{task.title}</p>
        <Badge
          variant="outline"
          className="shrink-0 border-border text-[10px]"
          style={{ color: PRIORITY_MAP[task.priority].color }}
        >
          {PRIORITY_MAP[task.priority].label}
        </Badge>
      </div>
      {task.client_name ? (
        <p className="mt-1 text-xs text-muted-foreground">{task.client_name}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {task.assignee_name ? <span>{task.assignee_name}</span> : <span className="italic">Non assigné</span>}
        {task.deadline ? (
          <span className={cn('tabular-nums', od && 'font-semibold text-destructive')}>
            {format(new Date(task.deadline), 'd MMM · HH:mm', { locale: fr })}
          </span>
        ) : (
          <span>Pas d&apos;échéance</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1 border-t border-border/60 pt-2">
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

export function TasksKanban({
  tasks,
  clients,
  employees,
  canDelete,
}: {
  tasks: TaskEnriched[];
  clients: Pick<Client, 'id' | 'name'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
}) {
  const byStatus = TASK_KANBAN_STATUSES.map((status) => ({
    status,
    label: TASK_STATUS_MAP[status].label,
    color: TASK_STATUS_MAP[status].color,
    items: tasks.filter((t) => t.status === status),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {byStatus.map((col) => (
        <div
          key={col.status}
          className="flex w-[280px] shrink-0 flex-col rounded-2xl border border-border/70 bg-card/90"
        >
          <div
            className="flex items-center justify-between border-b border-border/60 px-3 py-2.5"
            style={{ borderTopColor: col.color, borderTopWidth: 3 }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{col.label}</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {col.items.length}
            </span>
          </div>
          <div className="flex max-h-[min(70vh,720px)] flex-col gap-2 overflow-y-auto p-2">
            {col.items.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">Aucune tâche</p>
            ) : (
              col.items.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  clients={clients}
                  employees={employees}
                  canDelete={canDelete}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
