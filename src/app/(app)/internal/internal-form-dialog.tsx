'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Employee, InternalProject, InternalPriority, ProjectStatus } from '@/types/database';
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
import { PROJECT_STATUS_MAP, INTERNAL_PRIORITY_MAP } from '@/types/domain';
import { createInternalProjectAction, updateInternalProjectAction } from './actions';
import { OperationalDateField } from '@/components/shared/operational-date-field';

const selectCls =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function InternalProjectFormDialog({
  employees,
  trigger,
  project,
}: {
  employees: Pick<Employee, 'id' | 'full_name'>[];
  trigger: React.ReactNode;
  project?: InternalProject;
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
          <DialogTitle>{edit ? 'Modifier le projet interne' : 'Nouveau projet interne Supra v.'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={async (formData) => {
            setErr(null);
            setPending(true);
            try {
              const res = edit
                ? await updateInternalProjectAction(project!.id, formData)
                : await createInternalProjectAction(formData);
              if (!res.ok) {
                setErr(res.error);
                return;
              }
              router.refresh();
              setOpen(false);
              if (!edit && res.ok && res.data?.id) router.push(`/internal/${res.data.id}`);
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="ip-title">Titre</Label>
            <Input id="ip-title" name="title" required defaultValue={project?.title} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ip-cat">Catégorie / pôle</Label>
            <Input
              id="ip-cat"
              name="category"
              placeholder="SEO, Marketing, Produit…"
              defaultValue={project?.category ?? ''}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ip-status">Statut</Label>
              <select id="ip-status" name="status" className={selectCls} defaultValue={project?.status ?? 'in_progress'}>
                {(Object.keys(PROJECT_STATUS_MAP) as ProjectStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {PROJECT_STATUS_MAP[k].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ip-prio">Priorité</Label>
              <select
                id="ip-prio"
                name="priority"
                className={selectCls}
                defaultValue={project?.priority ?? 'normal'}
              >
                {(Object.keys(INTERNAL_PRIORITY_MAP) as InternalPriority[]).map((k) => (
                  <option key={k} value={k}>
                    {INTERNAL_PRIORITY_MAP[k].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ip-prog">Progression %</Label>
              <Input
                id="ip-prog"
                name="progress"
                type="number"
                min={0}
                max={100}
                defaultValue={project?.progress ?? 0}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ip-owner">Owner</Label>
              <select id="ip-owner" name="owner_id" className={selectCls} defaultValue={project?.owner_id ?? ''}>
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
              <Label htmlFor="ip-start">Début</Label>
              <Input id="ip-start" name="start_date" type="date" defaultValue={project?.start_date ?? ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ip-deadline">Échéance</Label>
              <OperationalDateField
                id="ip-deadline"
                name="deadline"
                defaultValue={project?.deadline ?? ''}
                unchangedBaseline={project?.deadline ?? undefined}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ip-desc">Description</Label>
            <Textarea id="ip-desc" name="description" rows={3} defaultValue={project?.description ?? ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ip-notes">Notes</Label>
            <Textarea id="ip-notes" name="notes" rows={2} defaultValue={project?.notes ?? ''} />
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <Button type="submit" variant="primary" disabled={pending} className="rounded-full">
            {pending ? 'Enregistrement…' : edit ? 'Mettre à jour' : 'Créer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
