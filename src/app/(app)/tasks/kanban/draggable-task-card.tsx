'use client';

import { useState, useTransition } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, GripVertical, MoreHorizontal } from 'lucide-react';
import type { Client, Employee, Task, TaskStatus, TaskEnriched } from '@/types/database';
import { TASK_STATUS_MAP, PRIORITY_MAP, TASK_KANBAN_STATUSES } from '@/types/domain';
import { cn } from '@/lib/utils/cn';
import {
  getKanbanCardPresentation,
  getTaskStatusAccentColor,
  KANBAN_CARD_SHELL,
  KANBAN_STATUS_ACCENT_CLASS,
  kanbanStatusAccentStyle,
} from '@/lib/ui/kanban-card-colors';
import { getTaskDeadlineState } from '@/lib/deadlines/deadline-state';
import { getTaskPriorityBadgeClass, getTaskStatusBadgeClass, operationalBadgeClass } from '@/lib/ui/status-colors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskFormDialog } from '../task-form-dialog';
import { TaskDetailDialog } from './task-detail-dialog';
import { ConfirmTaskActionDialog, type TaskConfirmActionMode } from '../confirm-task-action-dialog';
import { updateTaskStatusAction } from '../actions';
import { hrefVideosOpenDetail } from '@/lib/videos/video-deep-link';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { requestCriticalAlertsRefresh } from '@/lib/alerts/request-critical-alerts-refresh';
import { isTaskOverdueForAlert } from '@/lib/alerts/active-alert-rules';

function overdue(task: Task): boolean {
  return isTaskOverdueForAlert({ status: task.status, deadline: task.deadline });
}

function TaskCardActionsMenu({
  task,
  clients,
  employees,
  canDelete,
  canEdit,
  canChangeStatus,
  onOpenDetail,
  onRequestConfirm,
}: {
  task: TaskEnriched;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
  canEdit: boolean;
  canChangeStatus: boolean;
  onOpenDetail: () => void;
  onRequestConfirm: (mode: TaskConfirmActionMode) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function updateStatus(nextStatus: TaskStatus) {
    startTransition(async () => {
      const res = await updateTaskStatusAction(task.id, nextStatus);
      if (!res.ok) {
        toast.error(res.error || 'Impossible de mettre à jour le statut.');
        return;
      }
      toast.success(nextStatus === 'done' ? 'Tâche marquée comme terminée' : 'Statut mis à jour', {
        duration: 2000,
      });
      requestCriticalAlertsRefresh();
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Actions tâche"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[120] w-56"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          onSelect={() => {
            onOpenDetail();
          }}
        >
          Détails
        </DropdownMenuItem>
        {canEdit ? (
          <TaskFormDialog
            task={task}
            clients={clients}
            employees={employees}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Modifier</DropdownMenuItem>
            }
          />
        ) : null}
        {canChangeStatus ? (
          <>
            <DropdownMenuItem
              disabled={pending || task.status === 'done'}
              onSelect={() => updateStatus('done')}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
              Marquer comme terminé
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Changer le statut</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="z-[130]">
                {TASK_KANBAN_STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    disabled={pending || task.status === s}
                    onSelect={() => updateStatus(s)}
                  >
                    {TASK_STATUS_MAP[s].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}
        {task.video_id ? (
          <DropdownMenuItem asChild>
            <Link href={hrefVideosOpenDetail(task.video_id)}>Ouvrir la vidéo</Link>
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-orange-600 focus:text-orange-600 dark:text-orange-300"
              onSelect={() => onRequestConfirm('archive')}
            >
              Archiver
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onRequestConfirm('delete')}
            >
              Supprimer
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DraggableTaskCard({
  task,
  clients,
  employees,
  canDelete,
  canEdit,
  canChangeStatus,
  dragEnabled,
  compact = false,
  pulseHighlight = false,
}: {
  task: TaskEnriched;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
  canEdit: boolean;
  canChangeStatus: boolean;
  dragEnabled: boolean;
  compact?: boolean;
  pulseHighlight?: boolean;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<TaskConfirmActionMode | null>(null);
  const router = useRouter();
  const od = overdue(task);
  const statusAccent = getTaskStatusAccentColor(task.status);
  const kanbanColors = getKanbanCardPresentation({
    clientHex: task.client_brand_hex,
    statusAccentHex: statusAccent,
  });
  const dlState = getTaskDeadlineState(task.deadline, task.status);
  const showDeadline =
    Boolean(task.deadline) &&
    (od || dlState === 'today' || dlState === 'tomorrow' || dlState === 'soon');

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !dragEnabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  function openDetailFromCard(e: React.MouseEvent<HTMLElement>) {
    const t = e.target as HTMLElement;
    if (t.closest('a,button,select,option,[role="menuitem"]')) return;
    setDetailOpen(true);
  }

  const dragHandle = dragEnabled ? (
    <button
      type="button"
      aria-label="Glisser la tâche"
      className={cn(
        'flex h-8 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors',
        'hover:border-primary/35 hover:bg-muted/70 hover:text-foreground',
        'touch-none select-none',
        compact ? 'mt-0' : 'mt-0.5',
        isDragging && 'cursor-grabbing',
        !isDragging && 'cursor-grab active:cursor-grabbing',
      )}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  ) : null;

  return (
    <>
      <article
        ref={setNodeRef}
        style={{ ...kanbanColors.style, ...style }}
        data-task-id={task.id}
        className={cn(
          KANBAN_CARD_SHELL,
          kanbanColors.className,
          compact ? 'min-h-[82px] p-2.5 pl-3' : 'min-h-[100px] p-3 pl-3.5',
          pulseHighlight &&
            'ring-2 ring-primary/55 shadow-[0_0_0_3px_rgba(255,61,10,0.12)] dark:ring-[#FF6A2A]/45',
          isDragging && 'relative z-[200]',
          isDragging && '!transition-none',
          isDragging &&
            'scale-[1.02] cursor-grabbing opacity-[0.98] shadow-2xl ring-1 ring-primary/25 dark:shadow-black/50 dark:ring-primary/30',
          !compact && 'group transition-[box-shadow,border-color] duration-200 hover:border-border/70 hover:shadow-md',
        )}
      >
        <span
          className={KANBAN_STATUS_ACCENT_CLASS}
          style={kanbanStatusAccentStyle()}
          aria-hidden
        />

        {!compact ? (
          <div
            className="pointer-events-none absolute right-2 top-2 z-10 hidden opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 sm:flex"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <TaskCardActionsMenu
              task={task}
              clients={clients}
              employees={employees}
              canDelete={canDelete}
              canEdit={canEdit}
              canChangeStatus={canChangeStatus}
              onOpenDetail={() => setDetailOpen(true)}
              onRequestConfirm={setConfirmAction}
            />
          </div>
        ) : null}

        {compact ? (
          <div className="flex items-start gap-1.5">
            {dragHandle}
            <div
              role="button"
              tabIndex={0}
              onClick={openDetailFromCard}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailOpen(true);
                }
              }}
              className="flex min-w-0 flex-1 cursor-pointer flex-col justify-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <div className="flex items-start gap-1.5">
                <p className="line-clamp-2 min-w-0 flex-1 text-[13px] font-semibold leading-tight text-foreground">
                  {task.title}
                </p>
                <Badge
                  variant="outline"
                  className={cn('shrink-0 border-border px-1.5 text-[10px]', getTaskPriorityBadgeClass(task.priority))}
                >
                  {PRIORITY_MAP[task.priority].label}
                </Badge>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                {task.client_name ? (
                  <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
                    {task.client_brand_hex ? (
                      <ClientColorDot hex={task.client_brand_hex} size="sm" title={task.client_name} />
                    ) : null}
                    <span className="truncate">{task.client_name}</span>
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate italic">Sans client</span>
                )}
                <span className="flex shrink-0 items-center gap-1">
                  {task.assignees?.length ? (
                    <>
                      {task.assignees.slice(0, 2).map((p) => (
                        <span
                          key={p.id}
                          className="max-w-[3.75rem] truncate rounded border border-border/70 bg-background/45 px-1.5 py-px text-[10px] text-foreground/80"
                          title={p.full_name}
                        >
                          {p.full_name.split(/\s+/)[0] ?? p.full_name}
                        </span>
                      ))}
                      {task.assignees.length > 2 ? (
                        <span className="text-[10px] text-muted-foreground">+{task.assignees.length - 2}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[10px] italic text-muted-foreground">Non assigné</span>
                  )}
                </span>
              </div>
              <div className="flex min-h-5 flex-wrap items-center gap-1">
                {od ? (
                  <span
                    className={cn(
                      'rounded border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide',
                      operationalBadgeClass('danger'),
                    )}
                  >
                    En retard
                  </span>
                ) : null}
                <span
                  className={cn(
                    'rounded border px-1.5 py-px text-[9px] font-medium',
                    getTaskStatusBadgeClass(task.status),
                  )}
                >
                  {TASK_STATUS_MAP[task.status].label}
                </span>
                {showDeadline && task.deadline ? (
                  <span
                    className={cn(
                      'text-[10px] tabular-nums text-muted-foreground',
                      od && 'font-semibold text-destructive',
                    )}
                  >
                    {format(new Date(task.deadline), 'd MMM', { locale: fr })}
                  </span>
                ) : task.deadline ? (
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {format(new Date(task.deadline), 'd MMM', { locale: fr })}
                  </span>
                ) : null}
                {task.video_id ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-primary/30 px-1.5 text-[9px] font-medium text-primary"
                  >
                    Vidéo
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-start" onPointerDown={(e) => e.stopPropagation()}>
              <TaskCardActionsMenu
                task={task}
                clients={clients}
                employees={employees}
                canDelete={canDelete}
                canEdit={canEdit}
                canChangeStatus={canChangeStatus}
                onOpenDetail={() => setDetailOpen(true)}
                onRequestConfirm={setConfirmAction}
              />
            </div>
          </div>
        ) : null}
      </article>

      <TaskDetailDialog
        task={task}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        clients={clients}
        employees={employees}
        canDelete={canDelete}
      />
      <ConfirmTaskActionDialog
        open={confirmAction !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmAction(null);
        }}
        mode={confirmAction}
        taskId={task.id}
        onSuccess={() => {
          setConfirmAction(null);
          router.refresh();
        }}
      />
    </>
  );
}
