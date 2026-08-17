import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { getAuthContext } from '@/lib/auth/permissions';
import { canCreateTasks, canDeleteTask, canUpdateTasks } from '@/lib/auth/capabilities';
import type { AuthContext } from '@/lib/auth/permissions';
import { listTasksEnriched, type TaskListFilters } from '@/lib/data/tasks';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForSelect } from '@/lib/data/employees';
import { listCalendarVideoEvents } from '@/lib/data/videos-calendar';
import type { TaskPriority, TaskStatus } from '@/types/database';
import type { CalendarColorBy } from '@/lib/tasks/calendar-visual';
import { SectionCard } from '@/components/shared/section-card';
import { CalendarToolbar, type CalendarNav } from './calendar-toolbar';
import { CalendarMobileDefaultRedirect } from './calendar-mobile-default';
import dynamic from 'next/dynamic';

const TasksCalendarExperience = dynamic(
  () => import('./tasks-calendar-experience').then((m) => ({ default: m.TasksCalendarExperience })),
  {
    loading: () => (
      <div className="h-80 animate-pulse rounded-2xl border border-border/50 bg-muted/20" aria-hidden />
    ),
  },
);

export const metadata: Metadata = { title: 'Calendrier des tâches' };

export default async function TasksCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{
    view?: string;
    month?: string;
    day?: string;
    q?: string;
    assignee?: string;
    priority?: string;
    status?: string;
    client?: string;
    projectScope?: string;
    colorBy?: string;
  }>;
}) {
  const sp = await searchParams;
  const rawView = sp?.view;
  const view: CalendarNav['view'] =
    rawView === 'week' ? 'week' : rawView === 'day' ? 'day' : 'month';
  const today = new Date();

  let filterStart: Date;
  let filterEnd: Date;
  let displayDays: Date[];
  let nav: CalendarNav;
  let title: string;

  if (view === 'month') {
    const monthParam = sp?.month ?? format(today, 'yyyy-MM');
    const [y, m] = monthParam.split('-').map(Number);
    const anchorMonth = new Date(y, m - 1, 1);
    filterStart = startOfMonth(anchorMonth);
    filterEnd = endOfMonth(anchorMonth);
    const gridStart = startOfWeek(filterStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(filterEnd, { weekStartsOn: 1 });
    displayDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
    nav = {
      view: 'month',
      current: monthParam,
      prev: format(subMonths(anchorMonth, 1), 'yyyy-MM'),
      next: format(addMonths(anchorMonth, 1), 'yyyy-MM'),
    };
    title = format(anchorMonth, 'MMMM yyyy', { locale: fr });
  } else if (view === 'week') {
    const dayStr = sp?.day ?? format(today, 'yyyy-MM-dd');
    const anchorDay = parseISO(dayStr);
    const weekStart = startOfWeek(anchorDay, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(anchorDay, { weekStartsOn: 1 });
    filterStart = weekStart;
    filterEnd = weekEnd;
    displayDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const cur = format(anchorDay, 'yyyy-MM-dd');
    nav = {
      view: 'week',
      current: cur,
      prev: format(subWeeks(anchorDay, 1), 'yyyy-MM-dd'),
      next: format(addWeeks(anchorDay, 1), 'yyyy-MM-dd'),
    };
    title = `Semaine du ${format(weekStart, 'd MMM', { locale: fr })} au ${format(weekEnd, 'd MMM yyyy', { locale: fr })}`;
  } else {
    const dayStr = sp?.day ?? format(today, 'yyyy-MM-dd');
    const anchorDay = parseISO(dayStr);
    filterStart = startOfDay(anchorDay);
    filterEnd = endOfDay(anchorDay);
    displayDays = [anchorDay];
    nav = {
      view: 'day',
      current: dayStr,
      prev: format(subDays(anchorDay, 1), 'yyyy-MM-dd'),
      next: format(addDays(anchorDay, 1), 'yyyy-MM-dd'),
    };
    title = format(anchorDay, 'EEEE d MMMM yyyy', { locale: fr });
  }

  const from = startOfDay(filterStart).toISOString();
  const toIso = endOfDay(filterEnd).toISOString();

  const projectScope: TaskListFilters['projectScope'] =
    sp?.projectScope === 'client' || sp?.projectScope === 'internal' ? sp.projectScope : 'all';

  const colorBy: CalendarColorBy =
    sp?.colorBy === 'priority' || sp?.colorBy === 'assignee' || sp?.colorBy === 'client'
      ? sp.colorBy
      : 'status';

  const filters: TaskListFilters = {
    search: sp?.q,
    assigneeId: sp?.assignee === 'all' || !sp?.assignee ? 'all' : sp.assignee,
    priority:
      sp?.priority === 'all' || !sp?.priority ? 'all' : (sp.priority as TaskPriority),
    status: sp?.status === 'all' || !sp?.status ? 'all' : (sp.status as TaskStatus),
    deadlineFrom: from,
    deadlineTo: toIso,
    clientId: sp?.client === 'all' || !sp?.client ? 'all' : sp.client,
    projectScope,
  };

  const calCtx = await getAuthContext();
  const canDelete = canDeleteTask(calCtx?.role ?? null);
  const canEdit = canUpdateTasks(calCtx?.role ?? null);
  const canCreate = canCreateTasks(calCtx?.role ?? null);
  const [tasks, employees, clients, videoEvents] = await Promise.all([
    listTasksEnriched(filters, calCtx),
    listEmployeesForSelect(calCtx),
    listClients({}, calCtx),
    calCtx?.role
      ? listCalendarVideoEvents(calCtx as AuthContext, filterStart, filterEnd)
      : Promise.resolve([]),
  ]);

  const filterBag = {
    q: sp?.q,
    assignee: sp?.assignee,
    priority: sp?.priority,
    status: sp?.status,
    client: sp?.client,
    projectScope: sp?.projectScope,
    colorBy: sp?.colorBy,
  };

  const sectionTitle =
    view === 'month' ? 'Mois' : view === 'week' ? 'Semaine' : 'Jour';

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <CalendarMobileDefaultRedirect />
      </Suspense>

      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Calendrier</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Planification par échéance : vues mois, semaine et jour, codes couleur et filtres pour prioriser
        </p>
        {/* Glisser-déposer pour reprogrammer : non implémenté pour l’instant (TASK_CALENDAR_DND_TODO). */}
      </div>

      <CalendarToolbar
        nav={nav}
        title={title}
        employees={employees}
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          color_hex: c.color_hex,
          color_label: c.color_label,
        }))}
        canCreate={canCreate}
        filters={filterBag}
      />

      <SectionCard
        title={sectionTitle}
        description={`${tasks.length} tâche(s) avec échéance sur la période · couleur selon le critère choisi.`}
      >
        <TasksCalendarExperience
          view={view}
          filterStartISO={filterStart.toISOString()}
          filterEndISO={filterEnd.toISOString()}
          displayDayISOs={displayDays.map((d) => d.toISOString())}
          tasks={tasks}
          videoEvents={videoEvents}
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            color_hex: c.color_hex,
            color_label: c.color_label,
          }))}
          employees={employees}
          colorBy={colorBy}
          canDelete={canDelete}
          canEdit={canEdit}
        />
        <p className="mt-4 text-xs text-muted-foreground">
          Les tâches sans échéance n&apos;apparaissent pas ici — utilisez le board pour la liste complète.
        </p>
      </SectionCard>
    </div>
  );
}
