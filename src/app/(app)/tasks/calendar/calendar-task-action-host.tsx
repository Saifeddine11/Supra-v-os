'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Client, Employee, TaskEnriched } from '@/types/database';
import { TaskDetailDialog } from '../kanban/task-detail-dialog';
import { TaskFormDialog } from '../task-form-dialog';
import { ConfirmTaskActionDialog, type TaskConfirmActionMode } from '../confirm-task-action-dialog';
import { requestCriticalAlertsRefresh } from '@/lib/alerts/request-critical-alerts-refresh';
import {
  CalendarTaskAgendaActions,
  type CalendarTaskAgendaAction,
} from './calendar-task-agenda-actions';

/** Boutons + modales au même niveau (vue agenda jour, hors drawer). */
export function CalendarTaskActionHost({
  task,
  clients,
  employees,
  canDelete,
  canEdit,
  onMutated,
}: {
  task: TaskEnriched;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
  canEdit: boolean;
  onMutated?: () => void;
}) {
  const router = useRouter();
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<TaskConfirmActionMode | null>(null);

  function handleMutationSuccess() {
    setConfirmAction(null);
    setDetailOpen(false);
    setEditOpen(false);
    onMutated?.();
    requestCriticalAlertsRefresh();
    router.refresh();
  }

  function handleAction(_task: TaskEnriched, action: CalendarTaskAgendaAction) {
    if (action === 'detail') setDetailOpen(true);
    else if (action === 'edit') setEditOpen(true);
    else if (action === 'archive') setConfirmAction('archive');
    else if (action === 'delete') setConfirmAction('delete');
  }

  return (
    <>
      <CalendarTaskAgendaActions
        task={task}
        canDelete={canDelete}
        canEdit={canEdit}
        onAction={handleAction}
      />

      <TaskDetailDialog
        task={task}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        clients={clients}
        employees={employees}
        canDelete={canDelete}
        onMutated={handleMutationSuccess}
      />

      {canEdit ? (
        <TaskFormDialog
          task={task}
          clients={clients}
          employees={employees}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={handleMutationSuccess}
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
