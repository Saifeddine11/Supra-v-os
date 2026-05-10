'use client';

import type { TaskEnriched } from '@/types/database';
import { PRIORITY_MAP, TASK_STATUS_MAP } from '@/types/domain';
import { cn } from '@/lib/utils/cn';
import type { CalendarColorBy } from '@/lib/tasks/calendar-visual';
import { getCalendarTaskLabel, getCalendarTaskTone } from '@/lib/tasks/calendar-visual';
import { TaskFormDialog } from '../task-form-dialog';
import type { Client, Employee } from '@/types/database';

function initials(name: string | null | undefined): string {
  if (!name?.trim()) return '—';
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return `${p[0]![0]!}${p[p.length - 1]![0]!}`.toUpperCase();
}

export function CalendarTaskChip({
  task,
  colorBy,
  clients,
  employees,
  density,
}: {
  task: TaskEnriched;
  colorBy: CalendarColorBy;
  clients: Pick<Client, 'id' | 'name'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  density: 'month' | 'week';
}) {
  const accent = getCalendarTaskTone(task, colorBy);
  const label =
    density === 'month'
      ? getCalendarTaskLabel(task, 'month-desktop')
      : task.title;

  return (
    <TaskFormDialog
      task={task}
      clients={clients}
      employees={employees}
      trigger={
        <button
          type="button"
          className={cn(
            'w-full rounded-lg border border-border/60 border-l-[3px] px-2 py-1.5 text-left transition-colors',
            'min-h-[44px] md:min-h-0',
            accent.border,
            accent.tint,
            'hover:border-primary/35 hover:ring-1 hover:ring-primary/15',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2">
            <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', accent.dot)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'font-medium leading-snug text-foreground',
                  density === 'month' ? 'line-clamp-2 text-[11px]' : 'line-clamp-2 text-xs',
                )}
              >
                {label}
              </p>
              {density === 'week' ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="rounded-md bg-background/60 px-1.5 py-px font-medium text-foreground/85">
                    {TASK_STATUS_MAP[task.status].label}
                  </span>
                  <span>{PRIORITY_MAP[task.priority].label}</span>
                  {task.assignee_name ? (
                    <span
                      className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-muted px-1 text-[9px] font-semibold text-foreground/90"
                      title={task.assignee_name}
                    >
                      {initials(task.assignee_name)}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                  <span>{PRIORITY_MAP[task.priority].label}</span>
                  {task.assignee_name ? (
                    <span title={task.assignee_name}>{initials(task.assignee_name)}</span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </button>
      }
    />
  );
}
