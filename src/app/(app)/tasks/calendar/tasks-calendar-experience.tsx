'use client';

import { useMemo, useState } from 'react';
import { format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Client, Employee, TaskEnriched } from '@/types/database';
import { PRIORITY_MAP, TASK_STATUS_MAP } from '@/types/domain';
import { cn } from '@/lib/utils/cn';
import { getCalendarMobileTaskLabel } from '@/lib/tasks/calendar-mobile-label';
import type { CalendarColorBy } from '@/lib/tasks/calendar-visual';
import {
  calendarTaskOverdue,
  getCalendarTaskTone,
} from '@/lib/tasks/calendar-visual';
import { CalendarTaskChip } from './calendar-task-chip';
import { DayTasksDrawer } from './day-tasks-drawer';
import { TaskFormDialog } from '../task-form-dialog';
import { Button } from '@/components/ui/button';

const MONTH_VISIBLE_DESKTOP = 3;
const MONTH_VISIBLE_MOBILE = 1;

function sortByDeadline(a: TaskEnriched, b: TaskEnriched): number {
  const ta = a.deadline ? new Date(a.deadline).getTime() : Infinity;
  const tb = b.deadline ? new Date(b.deadline).getTime() : Infinity;
  return ta - tb;
}

function dayAgendaGroups(tasks: TaskEnriched[]) {
  const now = Date.now();
  const overdue: TaskEnriched[] = [];
  const active: TaskEnriched[] = [];
  const done: TaskEnriched[] = [];
  for (const t of tasks) {
    if (t.status === 'done') {
      done.push(t);
      continue;
    }
    if (t.deadline && new Date(t.deadline).getTime() < now) overdue.push(t);
    else active.push(t);
  }
  overdue.sort(sortByDeadline);
  active.sort(sortByDeadline);
  done.sort(sortByDeadline);
  return { overdue, active, done };
}

function DayAgendaView({
  anchorDay,
  tasks,
  clients,
  employees,
  colorBy,
}: {
  anchorDay: Date;
  tasks: TaskEnriched[];
  clients: Pick<Client, 'id' | 'name'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  colorBy: CalendarColorBy;
}) {
  const { overdue, active, done } = useMemo(() => dayAgendaGroups(tasks), [tasks]);

  const Section = ({
    title,
    items,
    toneClass,
  }: {
    title: string;
    items: TaskEnriched[];
    toneClass?: string;
  }) =>
    items.length === 0 ? null : (
      <div className="space-y-3">
        <h3
          className={cn(
            'text-xs font-bold uppercase tracking-wider',
            toneClass ?? 'text-muted-foreground',
          )}
        >
          {title}
        </h3>
        <ul className="space-y-3">
          {items.map((t) => {
            const accent = getCalendarTaskTone(t, colorBy);
            return (
              <li key={t.id}>
                <div
                  className={cn(
                    'rounded-xl border border-border/60 border-l-[3px] p-4 shadow-sm',
                    accent.border,
                    accent.tint,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug text-foreground">{t.title}</p>
                    <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', accent.dot)} aria-hidden />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getCalendarMobileTaskLabel(t)} · {TASK_STATUS_MAP[t.status].label} ·{' '}
                    {PRIORITY_MAP[t.priority].label}
                  </p>
                  {t.assignee_name ? (
                    <p className="mt-1 text-xs text-muted-foreground">Assigné : {t.assignee_name}</p>
                  ) : null}
                  {t.deadline ? (
                    <p
                      className={cn(
                        'mt-1 text-xs tabular-nums text-muted-foreground',
                        calendarTaskOverdue(t) && 'font-medium text-destructive',
                      )}
                    >
                      {format(new Date(t.deadline), "EEEE d MMM yyyy · HH:mm", { locale: fr })}
                    </p>
                  ) : null}
                  <div className="mt-3">
                    <TaskFormDialog
                      task={t}
                      clients={clients}
                      employees={employees}
                      trigger={
                        <Button type="button" variant="outline" size="sm" className="min-h-11 w-full rounded-full">
                          Ouvrir / modifier
                        </Button>
                      }
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );

  return (
    <div className="space-y-8">
      <p className="text-sm font-medium text-foreground">
        {format(anchorDay, "EEEE d MMMM yyyy", { locale: fr })}
      </p>
      <Section title="En retard" items={overdue} toneClass="text-destructive" />
      <Section title="À venir aujourd’hui" items={active} toneClass="text-primary" />
      <Section title="Terminées" items={done} toneClass="text-muted-foreground" />
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Aucune tâche avec échéance ce jour.
        </p>
      ) : null}
    </div>
  );
}

export function TasksCalendarExperience({
  view,
  filterStartISO,
  filterEndISO,
  displayDayISOs,
  tasks,
  clients,
  employees,
  colorBy,
}: {
  view: 'month' | 'week' | 'day';
  filterStartISO: string;
  filterEndISO: string;
  displayDayISOs: string[];
  tasks: TaskEnriched[];
  clients: Pick<Client, 'id' | 'name'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  colorBy: CalendarColorBy;
}) {
  const filterStart = useMemo(() => parseISO(filterStartISO), [filterStartISO]);
  const filterEnd = useMemo(() => parseISO(filterEndISO), [filterEndISO]);
  const displayDays = useMemo(() => displayDayISOs.map((iso) => parseISO(iso)), [displayDayISOs]);

  const [sheetDay, setSheetDay] = useState<Date | null>(null);
  const sheetTasks = useMemo(() => {
    if (!sheetDay) return [];
    return tasks
      .filter((t) => t.deadline && isSameDay(new Date(t.deadline), sheetDay))
      .slice()
      .sort(sortByDeadline);
  }, [sheetDay, tasks]);

  const openDay = (day: Date) => setSheetDay(day);
  const closeSheet = () => setSheetDay(null);

  if (view === 'day' && displayDays[0]) {
    const anchor = displayDays[0]!;
    return (
      <DayAgendaView
        anchorDay={anchor}
        tasks={tasks}
        clients={clients}
        employees={employees}
        colorBy={colorBy}
      />
    );
  }

  const isMonth = view === 'month';

  return (
    <>
      {view === 'week' ? (
        <div className="md:hidden space-y-6">
          {displayDays.map((day) => {
            const dayTasks = tasks
              .filter((t) => t.deadline && isSameDay(new Date(t.deadline), day))
              .slice()
              .sort(sortByDeadline);
            const isToday = isSameDay(day, new Date());
            if (dayTasks.length === 0) return null;
            return (
              <div key={day.toISOString()}>
                <button
                  type="button"
                  onClick={() => openDay(day)}
                  className={cn(
                    'flex w-full min-h-[44px] items-center justify-between rounded-lg border border-border/70 bg-card/80 px-3 py-2 text-left',
                    isToday && 'ring-1 ring-primary/40',
                  )}
                >
                  <span className="text-sm font-semibold capitalize text-foreground">
                    {format(day, 'EEEE d MMM', { locale: fr })}
                  </span>
                  <span className="text-xs font-medium text-primary">{dayTasks.length} tâche(s)</span>
                </button>
                <ul className="mt-3 space-y-2">
                  {dayTasks.map((t) => (
                    <li key={t.id}>
                      <CalendarTaskChip
                        task={t}
                        colorBy={colorBy}
                        clients={clients}
                        employees={employees}
                        density="week"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}

      <div
        className={cn(
          'grid gap-px overflow-x-hidden rounded-xl border border-border/80 bg-border/10',
          view === 'week' ? 'hidden md:grid md:grid-cols-7' : 'grid-cols-7',
        )}
      >
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div
            key={d}
            className="bg-card px-1 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground md:px-2 md:text-[10px]"
          >
            {d}
          </div>
        ))}
        {displayDays.map((day) => {
          const dayTasks = tasks
            .filter((t) => t.deadline && isSameDay(new Date(t.deadline), day))
            .slice()
            .sort(sortByDeadline);
          const isToday = isSameDay(day, new Date());
          const mutedOutsideMonth = isMonth && (day < filterStart || day > filterEnd);
          const sheetOpen = sheetDay !== null && isSameDay(day, sheetDay);
          const visibleDesktop = dayTasks.slice(0, MONTH_VISIBLE_DESKTOP);
          const visibleMobile = dayTasks.slice(0, MONTH_VISIBLE_MOBILE);
          const restDesktop = Math.max(0, dayTasks.length - MONTH_VISIBLE_DESKTOP);
          const restMobile = Math.max(0, dayTasks.length - MONTH_VISIBLE_MOBILE);
          const first = dayTasks[0];
          const firstAccent = first ? getCalendarTaskTone(first, colorBy) : null;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'flex min-h-[100px] flex-col gap-1 bg-card/95 p-1.5 sm:min-h-[120px] md:min-h-[140px] md:gap-1 md:p-2',
                isToday && 'ring-1 ring-inset ring-primary/45',
                sheetOpen && 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background',
                mutedOutsideMonth && 'opacity-40',
              )}
            >
              <button
                type="button"
                onClick={() => openDay(day)}
                className="w-full rounded-md px-0.5 text-left transition-colors hover:bg-muted/30"
              >
                <p className="text-xs font-medium text-muted-foreground md:text-[11px]">
                  <span className={cn(isToday && 'font-bold text-primary')}>
                    {format(day, 'd', { locale: fr })}
                  </span>
                  <span className="ml-1 hidden text-[10px] sm:inline">
                    {format(day, 'MMM', { locale: fr })}
                  </span>
                </p>
              </button>

              <div className="hidden min-h-0 flex-1 flex-col gap-1 overflow-y-auto md:flex">
                {view === 'week'
                  ? dayTasks.map((t) => (
                      <CalendarTaskChip
                        key={t.id}
                        task={t}
                        colorBy={colorBy}
                        clients={clients}
                        employees={employees}
                        density="week"
                      />
                    ))
                  : visibleDesktop.map((t) => (
                      <CalendarTaskChip
                        key={t.id}
                        task={t}
                        colorBy={colorBy}
                        clients={clients}
                        employees={employees}
                        density="month"
                      />
                    ))}
                {isMonth && restDesktop > 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDay(day);
                    }}
                    className="rounded-lg border border-dashed border-primary/40 bg-primary/[0.06] px-2 py-1.5 text-center text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    +{restDesktop}
                  </button>
                ) : null}
              </div>

              <div className="flex min-h-0 flex-1 flex-col md:hidden">
                {view === 'week' ? null : first ? (
                  <>
                    <button
                      type="button"
                      className={cn(
                        'flex min-h-[44px] w-full flex-col items-stretch justify-center gap-1 rounded-lg border border-border/55 border-l-[3px] px-2 py-2 text-left transition-colors active:bg-muted/40',
                        firstAccent?.border,
                        firstAccent?.tint ?? 'bg-muted/35',
                        calendarTaskOverdue(first) &&
                          'border-destructive/55 bg-destructive/[0.08] dark:bg-destructive/[0.1]',
                      )}
                      onClick={() => openDay(day)}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {firstAccent ? (
                          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', firstAccent.dot)} aria-hidden />
                        ) : null}
                        <span className="truncate text-sm font-semibold leading-tight text-foreground">
                          {getCalendarMobileTaskLabel(first)}
                        </span>
                      </div>
                      {restMobile > 0 ? (
                        <span className="pl-8 text-sm font-bold tabular-nums text-primary">+{restMobile}</span>
                      ) : null}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <DayTasksDrawer
        open={sheetDay !== null}
        onOpenChange={(o) => !o && closeSheet()}
        day={sheetDay}
        tasks={sheetTasks}
        clients={clients}
        employees={employees}
        colorBy={colorBy}
      />
    </>
  );
}
