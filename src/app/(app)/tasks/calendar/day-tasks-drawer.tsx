'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Client, Employee, TaskEnriched } from '@/types/database';
import { PRIORITY_MAP, TASK_STATUS_MAP } from '@/types/domain';
import { cn } from '@/lib/utils/cn';
import type { CalendarColorBy } from '@/lib/tasks/calendar-visual';
import { calendarTaskOverdue, getCalendarTaskTone } from '@/lib/tasks/calendar-visual';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TaskFormDialog } from '../task-form-dialog';

function taskContextLine(task: TaskEnriched): string {
  const name = task.client_name?.trim();
  if (name) return name;
  if (task.internal_project_id) return 'Projet interne Supra v.';
  return 'Interne';
}

export function DayTasksDrawer({
  open,
  onOpenChange,
  day,
  tasks,
  clients,
  employees,
  colorBy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date | null;
  tasks: TaskEnriched[];
  clients: Pick<Client, 'id' | 'name'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  colorBy: CalendarColorBy;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg',
          'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-h-[min(88vh,100dvh)] max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0',
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 pb-3 pt-5 text-left">
          <DialogTitle className="text-base font-semibold">
            {day ? `Tâches du ${format(day, 'EEEE d MMMM yyyy', { locale: fr })}` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune tâche ce jour-là.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {tasks.map((t) => {
                const od = calendarTaskOverdue(t);
                const accent = getCalendarTaskTone(t, colorBy);
                return (
                  <li
                    key={t.id}
                    className={cn(
                      'rounded-xl border border-border/80 border-l-[3px] bg-muted/20 px-3 py-3',
                      accent.border,
                      accent.tint,
                    )}
                  >
                    <p className="text-sm font-semibold leading-snug text-foreground">{t.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{taskContextLine(t)}</p>
                    <dl className="mt-2 grid gap-1 text-sm text-muted-foreground">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-medium text-foreground/80">Assigné</dt>
                        <dd>{t.assignee_name ?? '—'}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-medium text-foreground/80">Priorité</dt>
                        <dd>{PRIORITY_MAP[t.priority].label}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-medium text-foreground/80">Statut</dt>
                        <dd>{TASK_STATUS_MAP[t.status].label}</dd>
                      </div>
                      {t.deadline ? (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="font-medium text-foreground/80">Échéance</dt>
                          <dd className={cn('tabular-nums', od && 'font-medium text-destructive')}>
                            {format(new Date(t.deadline), 'd MMM yyyy · HH:mm', { locale: fr })}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    <div className="mt-3">
                      <TaskFormDialog
                        task={t}
                        clients={clients}
                        employees={employees}
                        trigger={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-11 w-full rounded-full"
                          >
                            Ouvrir / modifier
                          </Button>
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
