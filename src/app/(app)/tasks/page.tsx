import type { Metadata } from 'next';
import { listTasksEnriched, type TaskListFilters } from '@/lib/data/tasks';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForSelect } from '@/lib/data/employees';
import { getAuthContext } from '@/lib/auth/permissions';
import { canDeleteTask } from '@/lib/auth/capabilities';
import type { TaskPriority } from '@/types/database';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { TasksToolbar } from './tasks-toolbar';
import { TasksKanban } from './tasks-kanban';

export const metadata: Metadata = { title: 'Tâches' };

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

  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));
  const canDelete = canDeleteTask(ctx?.role ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Tâches</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kanban connecté à Supabase — colonnes alignées sur votre workflow.
        </p>
      </div>

      <TasksToolbar
        clients={clientOptions}
        employees={employees}
        defaultQ={sp?.q}
        defaultAssignee={sp?.assignee}
        defaultPriority={sp?.priority}
      />

      <SectionCard title="Board" description="Glisser-déposer : prochaine itération.">
        {tasks.length === 0 ? (
          <EmptyState
            title="Aucune tâche"
            description="Créez une tâche ou élargissez les filtres pour voir les cartes ici."
          />
        ) : (
          <TasksKanban
            tasks={tasks}
            clients={clientOptions}
            employees={employees}
            canDelete={canDelete}
          />
        )}
      </SectionCard>
    </div>
  );
}
