'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Client, Employee } from '@/types/database';
import { TaskFormDialog } from './task-form-dialog';

/** Ouvre le formulaire « Nouvelle tâche » quand l’URL contient ?new=task (topbar, dashboard). */
export function TasksNewTaskOpener({
  clients,
  employees,
}: {
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantOpen = searchParams.get('new') === 'task';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (wantOpen) setOpen(true);
  }, [wantOpen]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && wantOpen) {
      const p = new URLSearchParams(searchParams.toString());
      p.delete('new');
      const qs = p.toString();
      router.replace(qs ? `/tasks?${qs}` : '/tasks', { scroll: false });
    }
  }

  if (!wantOpen && !open) return null;

  return (
    <TaskFormDialog
      clients={clients}
      employees={employees}
      open={open}
      onOpenChange={handleOpenChange}
    />
  );
}
