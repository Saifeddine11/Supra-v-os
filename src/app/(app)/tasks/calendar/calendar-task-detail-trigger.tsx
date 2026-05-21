'use client';

import { useState } from 'react';
import type { Client, Employee, TaskEnriched } from '@/types/database';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { TaskDetailDialog } from '../kanban/task-detail-dialog';

/** Ouvre la même fiche tâche que le board (/tasks), avec droits alignés sur canDeleteTask. */
export function CalendarTaskDetailTrigger({
  task,
  clients,
  employees,
  canDelete,
  label = 'Ouvrir / modifier',
  className,
  onMutated,
}: {
  task: TaskEnriched;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canDelete: boolean;
  label?: string;
  className?: string;
  /** Fermer le drawer parent après archivage / suppression. */
  onMutated?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('min-h-11 w-full rounded-full', className)}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <TaskDetailDialog
        task={task}
        open={open}
        onOpenChange={setOpen}
        clients={clients}
        employees={employees}
        canDelete={canDelete}
        onMutated={onMutated}
      />
    </>
  );
}
