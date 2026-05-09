'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Client, Employee, Project, ProjectStatus, TaskPriority } from '@/types/database';
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
import { PROJECT_STATUS_MAP, PROJECT_TYPE_OPTIONS, PRIORITY_MAP } from '@/types/domain';
import { createProjectAction, updateProjectAction } from './actions';

const selectCls =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function ProjectFormDialog({
  clients,
  employees,
  trigger,
  project,
}: {
  clients: Pick<Client, 'id' | 'name'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  trigger: React.ReactNode;
  project?: Project;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const edit = Boolean(project);

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit ? 'Modifier le projet' : 'Nouveau projet client'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={async (formData) => {
            setErr(null);
            setPending(true);
            try {
              const res = edit
                ? await updateProjectAction(project!.id, formData)
                : await createProjectAction(formData);
              if (!res.ok) {
                setErr(res.error);
                return;
              }
              router.refresh();
              setOpen(false);
              if (!edit && res.ok && res.data?.id) router.push(`/projects/${res.data.id}`);
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="p-title">Nom du projet</Label>
            <Input id="p-title" name="title" required defaultValue={project?.title} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-client">Client</Label>
            <select
              id="p-client"
              name="client_id"
              required
              disabled={edit}
              defaultValue={project?.client_id}
              className={selectCls}
            >
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-type">Type</Label>
              <select id="p-type" name="type" className={selectCls} defaultValue={project?.type ?? 'website'}>
                {PROJECT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-prio">Priorité</Label>
              <select
                id="p-prio"
                name="priority"
                className={selectCls}
                defaultValue={project?.priority ?? 'normal'}
              >
                {(Object.keys(PRIORITY_MAP) as TaskPriority[]).map((k) => (
                  <option key={k} value={k}>
                    {PRIORITY_MAP[k].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-status">Statut</Label>
              <select id="p-status" name="status" className={selectCls} defaultValue={project?.status ?? 'todo'}>
                {(Object.keys(PROJECT_STATUS_MAP) as ProjectStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {PROJECT_STATUS_MAP[k].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-prog">Progression %</Label>
              <Input
                id="p-prog"
                name="progress"
                type="number"
                min={0}
                max={100}
                defaultValue={project?.progress ?? 0}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-lead">Chef de projet / lead</Label>
            <select id="p-lead" name="lead_id" className={selectCls} defaultValue={project?.lead_id ?? ''}>
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-start">Début</Label>
              <Input id="p-start" name="start_date" type="date" defaultValue={project?.start_date ?? ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-deadline">Échéance</Label>
              <Input id="p-deadline" name="deadline" type="date" defaultValue={project?.deadline ?? ''} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-budget">Budget (optionnel)</Label>
            <Input
              id="p-budget"
              name="budget"
              type="number"
              min={0}
              step={0.01}
              defaultValue={project?.budget ?? ''}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" name="description" rows={3} defaultValue={project?.description ?? ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-notes">Notes internes</Label>
            <Textarea id="p-notes" name="notes_internal" rows={2} defaultValue={project?.notes_internal ?? ''} />
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <Button type="submit" variant="primary" disabled={pending} className="rounded-full">
            {pending ? 'Enregistrement…' : edit ? 'Mettre à jour' : 'Créer le projet'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
