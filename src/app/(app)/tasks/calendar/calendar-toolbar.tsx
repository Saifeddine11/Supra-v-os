import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import type { Client, Employee, TaskPriority, TaskStatus } from '@/types/database';
import { TASK_KANBAN_STATUSES, TASK_STATUS_MAP, PRIORITY_MAP } from '@/types/domain';
import type { CalendarColorBy } from '@/lib/tasks/calendar-visual';
import { getCalendarColorByLabel } from '@/lib/tasks/calendar-visual';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QuickTaskCreateButton } from '@/components/tasks/quick-task-create-button';

export type CalendarNav =
  | { view: 'month'; current: string; prev: string; next: string }
  | { view: 'week'; current: string; prev: string; next: string }
  | { view: 'day'; current: string; prev: string; next: string };

export type CalendarFilterBag = {
  q?: string;
  assignee?: string;
  priority?: string;
  status?: string;
  client?: string;
  projectScope?: string;
  colorBy?: string;
};

function calendarHref(view: CalendarNav['view'], period: string, f: CalendarFilterBag) {
  const u = new URLSearchParams();
  u.set('view', view);
  if (view === 'month') u.set('month', period);
  else u.set('day', period);
  if (f.q) u.set('q', f.q);
  if (f.assignee && f.assignee !== 'all') u.set('assignee', f.assignee);
  if (f.priority && f.priority !== 'all') u.set('priority', f.priority);
  if (f.status && f.status !== 'all') u.set('status', f.status);
  if (f.client && f.client !== 'all') u.set('client', f.client);
  if (f.projectScope && f.projectScope !== 'all') u.set('projectScope', f.projectScope);
  if (f.colorBy && f.colorBy !== 'status') u.set('colorBy', f.colorBy);
  return `/tasks/calendar?${u.toString()}`;
}

/** Période jour (yyyy-MM-dd) cohérente lors du changement de vue. */
function anchorDayForLinks(nav: CalendarNav): string {
  if (nav.view === 'day' || nav.view === 'week') return nav.current;
  const [y, m] = nav.current.split('-').map(Number);
  const today = new Date();
  if (today.getFullYear() === y && today.getMonth() === m - 1) {
    return format(today, 'yyyy-MM-dd');
  }
  return format(new Date(y, m - 1, 1), 'yyyy-MM-dd');
}

function monthFromNav(nav: CalendarNav): string {
  if (nav.view === 'month') return nav.current;
  return format(parseISO(nav.current), 'yyyy-MM');
}

export function CalendarToolbar({
  nav,
  title,
  employees,
  clients,
  canCreate,
  filters,
}: {
  nav: CalendarNav;
  title: string;
  employees: Pick<Employee, 'id' | 'full_name'>[];
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  canCreate: boolean;
  filters: CalendarFilterBag;
}) {
  const dayAnchor = anchorDayForLinks(nav);
  const monthAnchor = monthFromNav(nav);
  const colorByVal = (filters.colorBy ?? 'status') as CalendarColorBy;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <Button variant="outline" size="sm" asChild>
            <Link href={calendarHref(nav.view, nav.prev, filters)}>←</Link>
          </Button>
          <p className="min-w-0 max-w-[min(100%,280px)] text-center text-sm font-semibold capitalize text-foreground sm:min-w-[200px]">
            {title}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={calendarHref(nav.view, nav.next, filters)}>→</Link>
          </Button>
        </div>
        <div className="flex justify-center rounded-full border border-border p-0.5 sm:justify-end">
          <Button
            variant={nav.view === 'month' ? 'primary' : 'ghost'}
            size="sm"
            className="rounded-full px-3"
            asChild
          >
            <Link href={calendarHref('month', monthAnchor, filters)}>Mois</Link>
          </Button>
          <Button
            variant={nav.view === 'week' ? 'primary' : 'ghost'}
            size="sm"
            className="rounded-full px-3"
            asChild
          >
            <Link href={calendarHref('week', dayAnchor, filters)}>Semaine</Link>
          </Button>
          <Button
            variant={nav.view === 'day' ? 'primary' : 'ghost'}
            size="sm"
            className="rounded-full px-3"
            asChild
          >
            <Link href={calendarHref('day', dayAnchor, filters)}>Jour</Link>
          </Button>
        </div>
      </div>

      <form method="GET" action="/tasks/calendar" className="space-y-3">
        <input type="hidden" name="view" value={nav.view} />
        {nav.view === 'month' ? (
          <input type="hidden" name="month" value={nav.current} />
        ) : (
          <input type="hidden" name="day" value={nav.current} />
        )}

        <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto pb-1 px-1 md:flex-wrap md:overflow-visible">
          <Input
            name="q"
            placeholder="Rechercher…"
            defaultValue={filters.q}
            className="min-w-[160px] shrink-0 md:max-w-[200px]"
          />
          <select
            name="assignee"
            defaultValue={filters.assignee ?? 'all'}
            className="h-11 min-w-[150px] shrink-0 rounded-lg border border-border bg-muted px-3 text-sm text-foreground"
          >
            <option value="all">Assigné</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
          <select
            name="client"
            defaultValue={filters.client ?? 'all'}
            className="h-11 min-w-[150px] shrink-0 rounded-lg border border-border bg-muted px-3 text-sm text-foreground"
          >
            <option value="all">Client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="projectScope"
            defaultValue={filters.projectScope ?? 'all'}
            className="h-11 min-w-[160px] shrink-0 rounded-lg border border-border bg-muted px-3 text-sm text-foreground"
          >
            <option value="all">Type de tâche</option>
            <option value="client">Liées à un client</option>
            <option value="internal">Projet interne</option>
          </select>
          <select
            name="priority"
            defaultValue={filters.priority ?? 'all'}
            className="h-11 min-w-[130px] shrink-0 rounded-lg border border-border bg-muted px-3 text-sm text-foreground"
          >
            <option value="all">Priorité</option>
            {(['low', 'normal', 'high', 'urgent'] as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_MAP[p].label}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filters.status ?? 'all'}
            className="h-11 min-w-[150px] shrink-0 rounded-lg border border-border bg-muted px-3 text-sm text-foreground"
          >
            <option value="all">Statut</option>
            {TASK_KANBAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_MAP[s].label}
              </option>
            ))}
          </select>
          <select
            name="colorBy"
            defaultValue={colorByVal}
            className="h-11 min-w-[170px] shrink-0 rounded-lg border border-border bg-muted px-3 text-sm text-foreground"
            aria-label="Colorer par"
          >
            <option value="status">Couleur : {getCalendarColorByLabel('status')}</option>
            <option value="priority">Couleur : {getCalendarColorByLabel('priority')}</option>
            <option value="assignee">Couleur : {getCalendarColorByLabel('assignee')}</option>
            <option value="client">Couleur : {getCalendarColorByLabel('client')}</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="outline" size="sm" className="min-h-11 rounded-full">
            Appliquer les filtres
          </Button>
          {canCreate ? (
            <QuickTaskCreateButton
              clients={clients}
              employees={employees}
              className="min-h-11 gap-2"
            />
          ) : null}
          <Button variant="ghost" size="sm" className="min-h-11 rounded-full" asChild>
            <Link href="/tasks">Board</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
