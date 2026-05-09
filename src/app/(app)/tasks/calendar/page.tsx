import type { Metadata } from 'next';
import Link from 'next/link';
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { getAuthContext } from '@/lib/auth/permissions';
import { listTasksEnriched, type TaskListFilters } from '@/lib/data/tasks';
import { listEmployeesForSelect } from '@/lib/data/employees';
import type { TaskPriority, TaskStatus } from '@/types/database';
import { PRIORITY_MAP } from '@/types/domain';
import { SectionCard } from '@/components/shared/section-card';
import { cn } from '@/lib/utils/cn';
import { CalendarToolbar, type CalendarNav } from './calendar-toolbar';

export const metadata: Metadata = { title: 'Calendrier des tâches' };

function overdue(deadline: string | null, status: string): boolean {
  if (!deadline || status === 'done') return false;
  return new Date(deadline).getTime() < Date.now();
}

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
  }>;
}) {
  const sp = await searchParams;
  const view = sp?.view === 'week' ? 'week' : 'month';
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
  } else {
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
  }

  const from = startOfDay(filterStart).toISOString();
  const toD = startOfDay(filterEnd);
  toD.setHours(23, 59, 59, 999);
  const toIso = toD.toISOString();

  const filters: TaskListFilters = {
    search: sp?.q,
    assigneeId: sp?.assignee === 'all' || !sp?.assignee ? 'all' : sp.assignee,
    priority:
      sp?.priority === 'all' || !sp?.priority ? 'all' : (sp.priority as TaskPriority),
    status: sp?.status === 'all' || !sp?.status ? 'all' : (sp.status as TaskStatus),
    deadlineFrom: from,
    deadlineTo: toIso,
  };

  const calCtx = await getAuthContext();
  const [tasks, employees] = await Promise.all([
    listTasksEnriched(filters, calCtx),
    listEmployeesForSelect(calCtx),
  ]);

  const filterBag = {
    q: sp?.q,
    assignee: sp?.assignee,
    priority: sp?.priority,
    status: sp?.status,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Calendrier</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue type monday.com — filtres par équipe, priorité et statut. Glisser-déposer : à venir.
        </p>
      </div>

      <CalendarToolbar nav={nav} title={title} employees={employees} filters={filterBag} />

      <SectionCard
        title={view === 'month' ? 'Mois' : 'Semaine'}
        description={`${tasks.length} tâche(s) avec échéance dans la période.`}
      >
        <div className="grid grid-cols-7 gap-px rounded-xl border border-border/80 bg-border/10">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
            <div
              key={d}
              className="bg-card px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {displayDays.map((day) => {
            const dayTasks = tasks.filter(
              (t) => t.deadline && isSameDay(new Date(t.deadline), day)
            );
            const isToday = isSameDay(day, new Date());
            const mutedOutsideMonth =
              view === 'month' &&
              (day < filterStart || day > filterEnd);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'flex min-h-[120px] flex-col gap-1 bg-card/95 p-2 sm:min-h-[140px]',
                  isToday && 'ring-1 ring-inset ring-primary/35',
                  mutedOutsideMonth && 'opacity-40'
                )}
              >
                <p className="text-[11px] font-medium text-muted-foreground">
                  <span className={cn(isToday && 'text-primary')}>{format(day, 'd', { locale: fr })}</span>
                  <span className="ml-1 hidden text-[10px] sm:inline">
                    {format(day, 'MMM', { locale: fr })}
                  </span>
                </p>
                <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
                  {dayTasks.map((t) => {
                    const od = overdue(t.deadline, t.status);
                    return (
                      <Link
                        key={t.id}
                        href="/tasks"
                        className={cn(
                          'block rounded-lg border px-2 py-1.5 text-[11px] leading-tight transition-colors hover:border-primary/30 hover:bg-primary/[0.04]',
                          od
                            ? 'border-destructive/40 bg-destructive/[0.07] text-destructive'
                            : 'border-border/80 bg-muted/50 text-foreground'
                        )}
                      >
                        <span className="line-clamp-2 font-medium">{t.title}</span>
                        <span className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                          <span>{PRIORITY_MAP[t.priority].label}</span>
                          {t.assignee_name ? <span>· {t.assignee_name}</span> : null}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Astuce : les tâches sans échéance n&apos;apparaissent pas sur cette grille — utilisez le board
          complet.
        </p>
      </SectionCard>
    </div>
  );
}
