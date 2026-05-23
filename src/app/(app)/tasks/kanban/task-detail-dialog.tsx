'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Client, Employee, TaskEnriched, TaskStatus } from '@/types/database';
import { TASK_STATUS_MAP, PRIORITY_MAP, TASK_KANBAN_STATUSES } from '@/types/domain';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { getClientColor } from '@/lib/ui/client-colors';
import { getTaskDeadlineState } from '@/lib/deadlines/deadline-state';
import { getTaskPriorityBadgeClass, getTaskStatusBadgeClass } from '@/lib/ui/status-colors';
import { TaskFormDialog } from '../task-form-dialog';
import { ConfirmTaskActionDialog, type TaskConfirmActionMode } from '../confirm-task-action-dialog';
import { updateTaskStatusAction } from '../actions';
import { hrefVideosOpenDetail } from '@/lib/videos/video-deep-link';
import { toast } from 'sonner';
import { requestCriticalAlertsRefresh } from '@/lib/alerts/request-critical-alerts-refresh';

function isOverdue(task: TaskEnriched): boolean {
  if (!task.deadline || task.status === 'done') return false;
  return new Date(task.deadline).getTime() < Date.now();
}

function formatDt(iso: string | null | undefined, pattern: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, pattern, { locale: fr });
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  clients,
  employees,
  canDelete,
  onMutated,
}: {
  task: TaskEnriched;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
  /** Fermer drawer calendrier parent après mutation réussie. */
  onMutated?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<TaskConfirmActionMode | null>(null);

  function handleMutationSuccess() {
    setConfirmAction(null);
    onOpenChange(false);
    onMutated?.();
    requestCriticalAlertsRefresh();
    router.refresh();
  }
  const od = isOverdue(task);
  const dlState = getTaskDeadlineState(task.deadline, task.status);
  const clientRow = clients.find((c) => c.id === task.client_id);
  const clientHex = clientRow ? getClientColor(clientRow) : task.client_brand_hex;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange} modal={confirmAction === null}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'max-h-[min(90vh,880px)] w-[calc(100vw-24px)] gap-0 overflow-y-auto rounded-[24px] border-border/70 p-0 sm:max-w-[720px]',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/60 px-5 pb-4 pt-5 sm:gap-4 sm:px-6">
          <div className="min-w-0 flex-1 pr-2">
            <DialogTitle className="text-left text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
              {task.title}
            </DialogTitle>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:max-w-[min(100%,280px)]">
            <Badge
              variant="outline"
              className={cn('border-border/80 text-[11px] font-medium', getTaskStatusBadgeClass(task.status))}
            >
              {TASK_STATUS_MAP[task.status].label}
            </Badge>
            <Badge
              variant="outline"
              className={cn('border-border/80 text-[11px] font-medium', getTaskPriorityBadgeClass(task.priority))}
              style={{ color: PRIORITY_MAP[task.priority].color }}
            >
              {PRIORITY_MAP[task.priority].label}
            </Badge>
            <DialogClose
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </DialogClose>
          </div>
        </header>

        <div className="space-y-5 px-5 py-4 sm:px-6">
          {od ? (
            <div
              role="status"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              Échéance dépassée — mettez à jour le statut ou la date.
            </div>
          ) : null}

          <section className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/15 p-3 dark:bg-muted/10">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Client</span>
              {task.client_name || task.client_id ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  {clientHex ? <ClientColorDot hex={clientHex} size="sm" title={task.client_name ?? ''} /> : null}
                  {task.client_name ?? task.client_id ?? '—'}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex flex-wrap items-start gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">Assignés</span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {task.assignees?.length ? (
                  task.assignees.map((p) => (
                    <Badge
                      key={p.id}
                      variant="outline"
                      className="max-w-full truncate border-border/80 font-normal"
                    >
                      {p.full_name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">Non assigné</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Échéance</span>
                <p
                  className={cn(
                    'mt-0.5 font-medium tabular-nums text-foreground',
                    od && 'text-destructive',
                    dlState === 'today' && !od && 'text-orange-600 dark:text-orange-400',
                    dlState === 'tomorrow' && !od && 'text-amber-700 dark:text-amber-400',
                  )}
                >
                  {task.deadline
                    ? format(new Date(task.deadline), "d MMMM yyyy 'à' HH:mm", { locale: fr })
                    : 'Aucune'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Progression</span>
                <p className="mt-0.5 font-medium tabular-nums text-foreground">{task.progress}%</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {task.description?.trim() ? task.description : 'Aucune description.'}
            </p>
          </section>

          {(task.project_id || task.internal_project_id || task.video_id) && (
            <section className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Liens</h3>
              {task.project_id ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Projet : </span>
                  <Link
                    href={`/projects/${task.project_id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Ouvrir le projet
                  </Link>
                </p>
              ) : task.internal_project_id ? (
                <p className="text-sm text-muted-foreground">Projet interne lié (réf. système)</p>
              ) : null}
              {task.video_id ? (
                <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-3 dark:bg-primary/[0.08]">
                  <p className="text-sm font-medium text-foreground">Cette tâche est liée à une vidéo</p>
                  <Button variant="outline" size="sm" className="mt-2 border-primary/35" asChild>
                    <Link href={hrefVideosOpenDetail(task.video_id)}>Ouvrir la vidéo</Link>
                  </Button>
                </div>
              ) : null}
            </section>
          )}

          <section className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <span className="font-medium uppercase tracking-wide">Création</span>
              <p className="mt-0.5 tabular-nums text-foreground">{formatDt(task.created_at, "d MMM yyyy 'à' HH:mm")}</p>
            </div>
            <div>
              <span className="font-medium uppercase tracking-wide">Dernière modification</span>
              <p className="mt-0.5 tabular-nums text-foreground">{formatDt(task.updated_at, "d MMM yyyy 'à' HH:mm")}</p>
            </div>
            {task.is_recurring ? (
              <div className="sm:col-span-2">
                <Badge variant="outline" className="text-[10px]">
                  Tâche récurrente
                  {task.recurrence_pattern ? ` · ${task.recurrence_pattern}` : ''}
                </Badge>
              </div>
            ) : null}
          </section>

          {task.checklist?.length ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checklist</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {task.checklist.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <span className="mt-0.5 text-muted-foreground">{item.done ? '☑' : '☐'}</span>
                    <span className={cn(item.done && 'text-muted-foreground line-through')}>{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-2 border-t border-border/60 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</h3>
            <select
              className="h-10 w-full max-w-xs rounded-lg border border-border bg-muted px-3 text-sm text-foreground"
              value={task.status}
              disabled={pending}
              onChange={(e) => {
                const next = e.target.value as TaskStatus;
                startTransition(async () => {
                  const res = await updateTaskStatusAction(task.id, next);
                  if (!res.ok) {
                    toast.error(res.error || 'Impossible de mettre à jour le statut.');
                    return;
                  }
                  toast.success('Statut mis à jour');
                  requestCriticalAlertsRefresh();
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
          </section>

          <section
            className={cn(
              'flex flex-wrap gap-2 border-t border-border/60 pt-4',
              'pb-[max(1rem,env(safe-area-inset-bottom))]',
            )}
          >
            <TaskFormDialog
              task={task}
              clients={clients}
              employees={employees}
              onSaved={() => onOpenChange(false)}
              trigger={
                <Button type="button" variant="primary" className="rounded-full">
                  Modifier
                </Button>
              }
            />
            {task.video_id ? (
              <Button variant="outline" className="rounded-full" asChild>
                <Link href={hrefVideosOpenDetail(task.video_id)}>Ouvrir la vidéo</Link>
              </Button>
            ) : null}
            {canDelete ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full text-orange-600 dark:text-orange-300"
                  disabled={pending || confirmAction !== null}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmAction('archive');
                  }}
                >
                  Archiver
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full text-destructive"
                  disabled={pending || confirmAction !== null}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmAction('delete');
                  }}
                >
                  Supprimer
                </Button>
              </>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
    <ConfirmTaskActionDialog
      open={confirmAction !== null}
      onOpenChange={(next) => {
        if (!next) setConfirmAction(null);
      }}
      mode={confirmAction}
      taskId={task.id}
      onSuccess={handleMutationSuccess}
    />
    </>
  );
}
