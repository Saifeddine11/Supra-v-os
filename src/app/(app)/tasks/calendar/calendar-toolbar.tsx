import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import type { Employee, TaskPriority, TaskStatus } from '@/types/database';
import { TASK_STATUS_MAP, PRIORITY_MAP } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type CalendarNav =
  | { view: 'month'; current: string; prev: string; next: string }
  | { view: 'week'; current: string; prev: string; next: string };

function calendarHref(
  view: 'month' | 'week',
  period: string,
  filters: { q?: string; assignee?: string; priority?: string; status?: string }
) {
  const u = new URLSearchParams();
  u.set('view', view);
  if (view === 'month') u.set('month', period);
  else u.set('day', period);
  if (filters.q) u.set('q', filters.q);
  if (filters.assignee && filters.assignee !== 'all') u.set('assignee', filters.assignee);
  if (filters.priority && filters.priority !== 'all') u.set('priority', filters.priority);
  if (filters.status && filters.status !== 'all') u.set('status', filters.status);
  return `/tasks/calendar?${u.toString()}`;
}

export function CalendarToolbar({
  nav,
  title,
  employees,
  filters,
}: {
  nav: CalendarNav;
  title: string;
  employees: Pick<Employee, 'id' | 'full_name'>[];
  filters: {
    q?: string;
    assignee?: string;
    priority?: string;
    status?: string;
  };
}) {
  const monthForSwitch =
    nav.view === 'month' ? nav.current : format(parseISO(nav.current), 'yyyy-MM');
  const dayForSwitch = nav.view === 'week' ? nav.current : `${nav.current}-15`;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={calendarHref(nav.view, nav.prev, filters)}>←</Link>
        </Button>
        <p className="min-w-[200px] text-center text-sm font-medium capitalize text-foreground">{title}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={calendarHref(nav.view, nav.next, filters)}>→</Link>
        </Button>
        <div className="flex rounded-full border border-border p-0.5">
          <Button
            variant={nav.view === 'month' ? 'primary' : 'ghost'}
            size="sm"
            className="rounded-full px-3"
            asChild
          >
            <Link href={calendarHref('month', monthForSwitch, filters)}>Mois</Link>
          </Button>
          <Button
            variant={nav.view === 'week' ? 'primary' : 'ghost'}
            size="sm"
            className="rounded-full px-3"
            asChild
          >
            <Link href={calendarHref('week', dayForSwitch, filters)}>Semaine</Link>
          </Button>
        </div>
      </div>

      <form
        method="GET"
        action="/tasks/calendar"
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <input type="hidden" name="view" value={nav.view} />
        {nav.view === 'month' ? (
          <input type="hidden" name="month" value={nav.current} />
        ) : (
          <input type="hidden" name="day" value={nav.current} />
        )}
        <Input name="q" placeholder="Rechercher…" defaultValue={filters.q} className="sm:max-w-[200px]" />
        <select
          name="assignee"
          defaultValue={filters.assignee ?? 'all'}
          className="h-10 rounded-lg border border-border bg-muted px-3 text-sm text-foreground"
        >
          <option value="all">Tous les assignés</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={filters.priority ?? 'all'}
          className="h-10 rounded-lg border border-border bg-muted px-3 text-sm text-foreground"
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
          className="h-10 rounded-lg border border-border bg-muted px-3 text-sm text-foreground"
        >
          <option value="all">Statut</option>
          {(
            [
              'todo',
              'in_progress',
              'waiting_client',
              'waiting_team',
              'review',
              'blocked',
              'done',
            ] as TaskStatus[]
          ).map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_MAP[s].label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">
          Appliquer
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks">Board</Link>
        </Button>
      </form>
    </div>
  );
}
