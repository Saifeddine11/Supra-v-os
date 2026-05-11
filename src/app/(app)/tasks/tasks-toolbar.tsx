'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskFormDialog } from './task-form-dialog';
import type { Client, Employee, TaskPriority } from '@/types/database';
import { PRIORITY_MAP } from '@/types/domain';

export function TasksToolbar({
  clients,
  employees,
  defaultQ,
  defaultAssignee,
  defaultPriority,
}: {
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  defaultQ?: string;
  defaultAssignee?: string;
  defaultPriority?: string;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <form method="GET" action="/tasks" className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input name="q" placeholder="Rechercher…" defaultValue={defaultQ} className="sm:max-w-xs" />
        <select
          name="assignee"
          defaultValue={defaultAssignee ?? 'all'}
          className="h-10 rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-52"
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
          defaultValue={defaultPriority ?? 'all'}
          className="h-10 rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-44"
        >
          <option value="all">Toutes priorités</option>
          {(['low', 'normal', 'high', 'urgent'] as TaskPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_MAP[p].label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filtrer
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/tasks/calendar">Calendrier</Link>
        </Button>
        <TaskFormDialog
          clients={clients}
          employees={employees}
          trigger={
            <Button variant="primary" className="rounded-full">
              <Plus className="h-4 w-4" />
              Nouvelle tâche
            </Button>
          }
        />
      </div>
    </div>
  );
}
