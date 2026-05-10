import { SectionCard } from '@/components/shared/section-card';
import { PriorityBadge } from '@/components/shared/priority-badge';
import type { TaskRowMock } from '@/data/dashboard-mock';
import { cn } from '@/lib/utils/cn';
import { getStatusBlockSurface } from '@/lib/ui/status-block-tone';
import type { StatusBlockTone } from '@/lib/ui/status-block-tone';

function mockTaskRowTone(t: TaskRowMock): StatusBlockTone {
  if (t.overdue) return 'danger';
  if (t.priority === 'urgent') return 'danger';
  if (t.priority === 'high') return 'warning';
  return 'info';
}

function TaskList({ title, tasks }: { title: string; tasks: TaskRowMock[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li
            key={t.id}
            className={cn(
              'flex flex-wrap items-center justify-between gap-2 px-3 py-2',
              getStatusBlockSurface(mockTaskRowTone(t), { urgentGlow: Boolean(t.overdue) }),
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              <p className="text-xs text-muted-foreground">
                {t.assignee} · {t.due}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {t.overdue ? (
                <span className="text-[10px] font-semibold uppercase text-destructive">Retard</span>
              ) : null}
              <PriorityBadge priority={t.priority} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamTasksSection({
  today,
  overdue,
}: {
  today: TaskRowMock[];
  overdue: TaskRowMock[];
}) {
  return (
    <SectionCard title="Tâches équipe" description="Aujourd’hui, retards et priorités.">
      <div className="grid gap-6 md:grid-cols-2">
        <TaskList title="Aujourd’hui" tasks={today} />
        <TaskList title="En retard" tasks={overdue} />
      </div>
    </SectionCard>
  );
}
