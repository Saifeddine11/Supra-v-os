'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Client, Employee, Task, TaskEnriched, TaskPriority, TaskStatus } from '@/types/database';
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
import { cn } from '@/lib/utils/cn';
import { createTaskAction, updateTaskAction } from './actions';

const STATUSES: TaskStatus[] = [...TASK_KANBAN_STATUSES];
const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

function initialAssigneeSet(task: Task | TaskEnriched | null | undefined): Set<string> {
  if (!task) return new Set();
  const te = task as TaskEnriched;
  if (te.assignees?.length) return new Set(te.assignees.map((a) => a.id));
  if (task.assignee_id) return new Set([task.assignee_id]);
  return new Set();
}

export function TaskFormDialog({
  task,
  clients,
  employees,
  trigger,
}: {
  task?: Task | TaskEnriched | null;
  clients: Pick<Client, 'id' | 'name'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [assigneeSel, setAssigneeSel] = useState<Set<string>>(() => new Set());
  const isEdit = Boolean(task);
  const taskKey = task?.id ?? '__create__';
  const videoLinked = Boolean(task?.video_id);

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setAssigneeSel(initialAssigneeSet(task ?? null));
  }, [open, taskKey, task]);

  const dlValue =
    task?.deadline && !Number.isNaN(new Date(task.deadline).getTime())
      ? new Date(task.deadline).toISOString().slice(0, 16)
      : '';

  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr', { sensitivity: 'base' })),
    [employees],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[min(90vh,800px)] overflow-y-auto sm:max-w-lg">
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
          <input type="hidden" name="assignee_ids" value={JSON.stringify([...assigneeSel])} />
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
          </div>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label>Assignés</Label>
              <span className="text-xs text-muted-foreground">
                {assigneeSel.size === 0 ? 'Non assigné' : `${assigneeSel.size} personne(s)`}
              </span>
            </div>
            {videoLinked ? (
              <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Tâche liée à une vidéo : les assignés sont synchronisés depuis la fiche vidéo lors des mises à jour
                production.
              </p>
            ) : null}
            <div
              className={cn(
                'max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-3',
                videoLinked && 'pointer-events-none opacity-60',
              )}
            >
              {sortedEmployees.map((e) => (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                    disabled={videoLinked}
                    checked={assigneeSel.has(e.id)}
                    onChange={(ev) => {
                      setAssigneeSel((prev) => {
                        const n = new Set(prev);
                        if (ev.target.checked) n.add(e.id);
                        else n.delete(e.id);
                        return n;
                      });
                    }}
                  />
                  <span className="min-w-0 truncate">{e.full_name}</span>
                </label>
              ))}
            </div>
            {assigneeSel.size > 0 ? (
              <p className="text-xs text-muted-foreground">
                {[...assigneeSel]
                  .map((id) => employees.find((x) => x.id === id)?.full_name ?? id)
                  .join(', ')}
              </p>
            ) : null}
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
