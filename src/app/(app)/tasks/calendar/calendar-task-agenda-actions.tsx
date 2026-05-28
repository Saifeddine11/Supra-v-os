'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Client, Employee, TaskEnriched } from '@/types/database';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { TaskDetailDialog } from '../kanban/task-detail-dialog';
import { TaskFormDialog } from '../task-form-dialog';
import { ConfirmTaskActionDialog, type TaskConfirmActionMode } from '../confirm-task-action-dialog';
import { requestCriticalAlertsRefresh } from '@/lib/alerts/request-critical-alerts-refresh';

/** Actions agenda calendrier : détail, édition, archivage, suppression (sans modales imbriquées). */
export function CalendarTaskAgendaActions({
  task,
  clients,
  employees,
  canDelete,
  canEdit,
  onDrawerClose,
  onMutated,
}: {
  task: TaskEnriched;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
  canEdit: boolean;
  /** Fermer le drawer agenda avant d’ouvrir une autre modale (Safari / Radix). */
  onDrawerClose?: () => void;
  onMutated?: () => void;
}) {
  const router = useRouter();
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<TaskConfirmActionMode | null>(null);

  function suspendDrawerThen(fn: () => void) {
    onDrawerClose?.();
    requestAnimationFrame(() => fn());
  }

  function handleMutationSuccess() {
    setConfirmAction(null);
    setDetailOpen(false);
    setEditOpen(false);
    onMutated?.();
    requestCriticalAlertsRefresh();
    router.refresh();
  }

  const btnClass = 'min-h-11 w-full rounded-full text-sm';

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className={btnClass}
          onClick={() => suspendDrawerThen(() => setDetailOpen(true))}
        >
          Détails
        </Button>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={btnClass}
            onClick={() => suspendDrawerThen(() => setEditOpen(true))}
          >
            Modifier
          </Button>
        ) : null}
        {canDelete ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(btnClass, 'text-orange-600 dark:text-orange-300')}
              disabled={confirmAction !== null}
              onClick={() => suspendDrawerThen(() => setConfirmAction('archive'))}
            >
              Archiver
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(btnClass, 'border-destructive/40 text-destructive hover:bg-destructive/10')}
              disabled={confirmAction !== null}
              onClick={() => suspendDrawerThen(() => setConfirmAction('delete'))}
            >
              Supprimer
            </Button>
          </>
        ) : null}
      </div>

      <TaskDetailDialog
        task={task}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        clients={clients}
        employees={employees}
        canDelete={canDelete}
        onMutated={() => {
          setDetailOpen(false);
          handleMutationSuccess();
        }}
      />

      {canEdit ? (
        <TaskFormDialog
          task={task}
          clients={clients}
          employees={employees}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={() => {
            handleMutationSuccess();
          }}
        />
      ) : null}

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
