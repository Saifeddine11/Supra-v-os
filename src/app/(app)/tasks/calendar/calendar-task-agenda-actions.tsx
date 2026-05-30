'use client';

import type { TaskEnriched } from '@/types/database';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export type CalendarTaskAgendaAction = 'detail' | 'edit' | 'archive' | 'delete';

/** Boutons agenda calendrier — les modales sont montées hors du drawer (parent). */
export function CalendarTaskAgendaActions({
  task,
  canDelete,
  canEdit,
  onAction,
}: {
  task: TaskEnriched;
  canDelete: boolean;
  canEdit: boolean;
  onAction: (task: TaskEnriched, action: CalendarTaskAgendaAction, event: React.MouseEvent) => void;
}) {
  const btnClass = 'min-h-11 w-full rounded-full text-sm';

  function handle(action: CalendarTaskAgendaAction, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onAction(task, action, event);
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant="primary"
        size="sm"
        className={btnClass}
        onClick={(event) => handle('detail', event)}
      >
        Détails
      </Button>
      {canEdit ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={btnClass}
          onClick={(event) => handle('edit', event)}
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
            onClick={(event) => handle('archive', event)}
          >
            Archiver
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(btnClass, 'border-destructive/40 text-destructive hover:bg-destructive/10')}
            onClick={(event) => handle('delete', event)}
          >
            Supprimer
          </Button>
        </>
      ) : null}
    </div>
  );
}
