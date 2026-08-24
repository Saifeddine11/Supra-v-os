import Link from 'next/link';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge } from '@/components/shared/priority-badge';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { cn } from '@/lib/utils/cn';
import { getStatusBlockSurface } from '@/lib/ui/status-block-tone';
import type { SupervisorDashboardData, SupervisorTaskRow } from '@/lib/data/dashboard-supervisor';
import { supervisorDueCaption, supervisorTaskStatusLabel } from '@/lib/data/dashboard-supervisor';
import { hrefTasksOpenDetail } from '@/lib/tasks/task-deep-link';

function TaskGroup({ title, tasks, empty }: { title: string; tasks: SupervisorTaskRow[]; empty: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 px-3 py-2',
                getStatusBlockSurface(t.overdue ? 'danger' : t.priority === 'urgent' ? 'danger' : 'info', {
                  urgentGlow: t.overdue,
                }),
              )}
            >
              <div className="min-w-0">
                <Link href={hrefTasksOpenDetail(t.id)} className="text-sm font-medium text-foreground hover:text-primary">
                  {t.title}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {t.clientBrandHex && t.clientName ? (
                    <span className="inline-flex items-center gap-1">
                      <ClientColorDot hex={t.clientBrandHex} size="sm" title={t.clientName} />
                      <span>{t.clientName}</span>
                    </span>
                  ) : null}
                  <span>
                    {t.assignee} · {supervisorDueCaption(t)}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {supervisorTaskStatusLabel(t.status)}
                </span>
                {t.overdue ? (
                  <span className="text-[10px] font-semibold uppercase text-destructive">Retard</span>
                ) : null}
                <PriorityBadge priority={t.priority} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SupervisorDepartmentBoard({ data }: { data: SupervisorDashboardData }) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Équipe"
        description={`Membres du pôle ${data.departmentLabel}.`}
      >
        {data.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun membre actif dans ce pôle.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
            {data.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/team/${m.id}`} className="font-medium text-foreground hover:text-primary">
                    {m.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{m.roleLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="font-normal">
                    {m.activeTaskCount} active{m.activeTaskCount === 1 ? '' : 's'}
                  </Badge>
                  {m.overdueTaskCount > 0 ? (
                    <Badge variant="destructive" className="text-[10px]">
                      {m.overdueTaskCount} en retard
                    </Badge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Tâches du pôle" description="Aujourd’hui, à venir, en retard, bloquées et terminées — données live.">
        <div className="grid gap-6 lg:grid-cols-2">
          <TaskGroup title="Aujourd’hui" tasks={data.today} empty="Aucune tâche pour aujourd’hui." />
          <TaskGroup title="À venir" tasks={data.upcoming} empty="Aucune tâche à venir." />
          <TaskGroup title="En retard" tasks={data.overdue} empty="Aucune tâche en retard." />
          <TaskGroup title="Bloquées" tasks={data.blocked} empty="Aucune tâche bloquée." />
          <TaskGroup title="Terminées" tasks={data.completed} empty="Aucune tâche terminée récemment." />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Charge" description="Tâches actives et retards par membre du pôle.">
          {data.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pas de charge à afficher.</p>
          ) : (
            <ul className="space-y-3">
              {data.members.map((m) => (
                <li key={m.id} className="rounded-xl border border-border/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/team/${m.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {m.name}
                    </Link>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {m.activeTaskCount} active{m.activeTaskCount === 1 ? '' : 's'}
                      {m.overdueTaskCount > 0 ? ` · ${m.overdueTaskCount} retard` : ''}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        m.overdueTaskCount > 0 ? 'bg-destructive' : 'bg-primary',
                      )}
                      style={{ width: `${Math.min(100, m.activeTaskCount * 12)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Qui fait quoi" description="Travail actif en cours dans le pôle.">
          {data.members.every((m) => m.currentTasks.length === 0) ? (
            <p className="text-sm text-muted-foreground">Personne n’a de tâche en cours pour le moment.</p>
          ) : (
            <ul className="space-y-4">
              {data.members.map((m) => (
                <li key={m.id}>
                  <p className="text-sm font-medium text-foreground">{m.name}</p>
                  {m.currentTasks.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">Pas de travail en cours.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {m.currentTasks.map((t) => (
                        <li key={t.id} className="text-xs text-muted-foreground">
                          <Link href={hrefTasksOpenDetail(t.id)} className="hover:text-primary">
                            {t.title}
                          </Link>
                          <span className="ml-1.5 uppercase tracking-wide">
                            {supervisorTaskStatusLabel(t.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
