'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Client, Employee, TaskEnriched } from '@/types/database';
import { PRIORITY_MAP, TASK_STATUS_MAP, VIDEO_PUBLIC_STATUS_MAP, VIDEO_STATUS_MAP } from '@/types/domain';
import { cn } from '@/lib/utils/cn';
import type { CalendarColorBy } from '@/lib/tasks/calendar-visual';
import { calendarTaskOverdue, getCalendarTaskTone } from '@/lib/tasks/calendar-visual';
import { getTaskDeadlineState } from '@/lib/deadlines/deadline-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CalendarTaskDetailTrigger } from './calendar-task-detail-trigger';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import type { CalendarVideoEvent } from '@/lib/data/videos-calendar';

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
  videoEvents,
  clients,
  employees,
  colorBy,
  canDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date | null;
  tasks: TaskEnriched[];
  videoEvents: CalendarVideoEvent[];
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  colorBy: CalendarColorBy;
  canDelete: boolean;
}) {
  const hasAny = tasks.length > 0 || videoEvents.length > 0;

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
            {day ? `Agenda du ${format(day, 'EEEE d MMMM yyyy', { locale: fr })}` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          {!hasAny ? (
            <p className="text-sm text-muted-foreground">Aucun élément ce jour-là.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {tasks.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tâches</h3>
                  <ul className="flex flex-col gap-3">
                    {tasks.map((t) => {
                      const od = calendarTaskOverdue(t);
                      const accent = getCalendarTaskTone(t, colorBy);
                      const dlU = t.deadline ? getTaskDeadlineState(t.deadline, t.status) : 'none';
                      const urgency =
                        dlU === 'overdue'
                          ? 'En retard'
                          : dlU === 'today'
                            ? 'Échéance aujourd’hui'
                            : dlU === 'tomorrow'
                              ? 'Échéance demain'
                              : dlU === 'soon'
                                ? 'Échéance sous 3 jours'
                                : null;
                      return (
                        <li key={t.id}>
                          <div
                            className={cn(
                              'rounded-xl border border-border/80 border-l-[3px] bg-muted/20 px-3 py-3',
                              accent.border,
                              accent.tint,
                            )}
                          >
                            <p className="text-sm font-semibold leading-snug text-foreground">{t.title}</p>
                            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                              {t.client_brand_hex ? (
                                <ClientColorDot hex={t.client_brand_hex} title={t.client_name ?? undefined} />
                              ) : null}
                              <span>{taskContextLine(t)}</span>
                            </p>
                            <dl className="mt-2 grid gap-1 text-sm text-muted-foreground">
                              <div className="flex flex-wrap gap-x-2">
                                <dt className="font-medium text-foreground/80">Assignés</dt>
                                <dd className="min-w-0 flex-1">
                                  {t.assignees?.length
                                    ? t.assignees.map((p) => p.full_name).join(', ')
                                    : (t.assignee_name ?? 'Non assigné')}
                                </dd>
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
                              {urgency ? (
                                <div className="flex flex-wrap gap-x-2">
                                  <dt className="font-medium text-foreground/80">Urgence</dt>
                                  <dd
                                    className={cn(
                                      od && 'font-medium text-destructive',
                                      dlU === 'today' && !od && 'font-medium text-orange-600 dark:text-orange-400',
                                      dlU === 'tomorrow' && !od && 'font-medium text-amber-700 dark:text-amber-400',
                                    )}
                                  >
                                    {urgency}
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                            <div className="mt-3">
                              <CalendarTaskDetailTrigger
                                task={t}
                                clients={clients}
                                employees={employees}
                                canDelete={canDelete}
                                label="Détails · modifier · archiver"
                                onOpenDetail={() => onOpenChange(false)}
                                onMutated={() => onOpenChange(false)}
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {videoEvents.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Vidéo</h3>
                  <ul className="flex flex-col gap-3">
                    {videoEvents.map((ev) => (
                      <li key={ev.id}>
                        <div
                          className={cn(
                            'rounded-xl border border-border/80 border-l-[3px] bg-muted/15 px-3 py-3',
                            ev.kind === 'shoot'
                              ? 'border-l-violet-600 bg-violet-500/[0.06]'
                              : 'border-l-primary bg-primary/[0.06]',
                          )}
                        >
                          <p className="text-sm font-semibold leading-snug text-foreground">
                            {ev.kind === 'shoot' ? 'Tournage vidéo' : 'Livraison vidéo'} — {ev.title}
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Client :</span>
                            <ClientColorDot hex={ev.client_brand_hex} title={ev.clientName} />
                            <span>{ev.clientName}</span>
                          </p>
                          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                            {format(new Date(ev.at), 'd MMM yyyy · HH:mm', { locale: fr })}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {VIDEO_STATUS_MAP[ev.status].label} · {VIDEO_PUBLIC_STATUS_MAP[ev.public_status].label}
                          </p>
                          <div className="mt-3">
                            <Button type="button" variant="outline" size="sm" className="min-h-11 w-full rounded-full" asChild>
                              <Link href="/videos">Ouvrir la production vidéo</Link>
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
