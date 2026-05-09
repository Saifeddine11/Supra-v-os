'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Client, Employee, Task, TaskPriority, TaskStatus } from '@/types/database';
import { TASK_STATUS_MAP, PRIORITY_MAP, TASK_KANBAN_STATUSES } from '@/types/domain';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createTaskAction, updateTaskAction } from './actions';

const STATUSES: TaskStatus[] = [...TASK_KANBAN_STATUSES];
const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

export function TaskFormDialog({
  task,
  clients,
  employees,
  trigger,
}: {
  task?: Task | null;
  clients: Pick<Client, 'id' | 'name'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isEdit = Boolean(task);

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  const dlValue =
    task?.deadline && !Number.isNaN(new Date(task.deadline).getTime())
      ? new Date(task.deadline).toISOString().slice(0, 16)
      : '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            setErr(null);
            setPending(true);
            try {
              const res = isEdit
                ? await updateTaskAction(task!.id, formData)
                : await createTaskAction(formData);
              if (!res.ok) {
                setErr(res.error);
                return;
              }
              router.refresh();
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
          className="grid gap-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="task-title">Titre</Label>
            <Input id="task-title" name="title" required defaultValue={task?.title} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea id="task-desc" name="description" rows={3} defaultValue={task?.description ?? ''} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="task-client">Client</Label>
              <select
                id="task-client"
                name="client_id"
                defaultValue={task?.client_id ?? ''}
                className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
              >
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-assignee">Assigné</Label>
              <select
                id="task-assignee"
                name="assignee_id"
                defaultValue={task?.assignee_id ?? ''}
                className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
              >
                <option value="">—</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="task-status">Statut</Label>
              <select
                id="task-status"
                name="status"
                defaultValue={task?.status ?? 'todo'}
                className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_MAP[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-prio">Priorité</Label>
              <select
                id="task-prio"
                name="priority"
                defaultValue={task?.priority ?? 'normal'}
                className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_MAP[p].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-deadline">Échéance</Label>
            <Input id="task-deadline" name="deadline" type="datetime-local" defaultValue={dlValue} />
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
