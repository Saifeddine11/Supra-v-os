import type { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { listTasksEnriched, type TaskListFilters } from '@/lib/data/tasks';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForSelect } from '@/lib/data/employees';
import { getAuthContext } from '@/lib/auth/permissions';
import { taskListingDenied } from '@/lib/auth/data-scope';
import { canChangeTaskStatus, canCreateTasks, canDeleteTask, canUpdateTasks } from '@/lib/auth/capabilities';
import { TasksNewTaskOpener } from './tasks-new-task-opener';
import type { TaskPriority } from '@/types/database';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { TasksToolbar } from './tasks-toolbar';

export const metadata: Metadata = { title: 'Tâches' };

const TasksKanban = dynamic(() => import('./tasks-kanban').then((m) => ({ default: m.TasksKanban })), {
  loading: () => (
    <div className="h-72 animate-pulse rounded-2xl border border-border/50 bg-muted/20" aria-hidden />
  ),
});

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; assignee?: string; priority?: string }>;
}) {
  const ctx = await getAuthContext();
  const sp = await searchParams;
  const filters: TaskListFilters = {
    search: sp?.q,
    assigneeId: sp?.assignee === 'all' || !sp?.assignee ? 'all' : sp.assignee,
    priority:
      sp?.priority === 'all' || !sp?.priority
        ? 'all'
        : (sp.priority as TaskPriority),
  };

  const [tasks, clients, employees] = await Promise.all([
    listTasksEnriched(filters, ctx),
    listClients({}, ctx),
    listEmployeesForSelect(ctx),
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    color_hex: c.color_hex,
    color_label: c.color_label,
  }));
  const canDelete = canDeleteTask(ctx?.role ?? null);
  const canEdit = canUpdateTasks(ctx?.role ?? null);
  const canChangeStatus = canChangeTaskStatus(ctx?.role ?? null);
  const canCreate = canCreateTasks(ctx?.role ?? null);
  const allowKanbanDrag = Boolean(ctx && canChangeStatus && !taskListingDenied(ctx));

  return (
    <div className="space-y-3.5">
      <Suspense fallback={null}>
        <TasksNewTaskOpener clients={clientOptions} employees={employees} />
      </Suspense>
      <div>
        <h1 className="font-sans text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Tâches</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Kanban connecté à Supabase — colonnes alignées sur votre workflow.
        </p>
      </div>

      <TasksToolbar
        clients={clientOptions}
        employees={employees}
        canCreate={canCreate}
        defaultQ={sp?.q}
        defaultAssignee={sp?.assignee}
        defaultPriority={sp?.priority}
      />

      <SectionCard
        title="Board"
        description="Glissez une tâche ou utilisez le menu de chaque carte."
        className="[&>div]:p-2 md:[&>div]:p-2.5 [&>header]:gap-2 [&>header]:px-4 [&>header]:py-2.5"
      >
        {tasks.length === 0 ? (
          <EmptyState
            title="Aucune tâche"
            description="Créez une tâche ou élargissez les filtres pour voir les cartes ici."
          />
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground md:hidden">
              Sur mobile, utilisez le menu de statut sur chaque carte.
            </p>
            <TasksKanban
              tasks={tasks}
              clients={clientOptions}
              employees={employees}
              canDelete={canDelete}
              canEdit={canEdit}
              canChangeStatus={canChangeStatus}
              allowKanbanDrag={allowKanbanDrag}
            />
          </>
        )}
      </SectionCard>
    </div>
  );
}
