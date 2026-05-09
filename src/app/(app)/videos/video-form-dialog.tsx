'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Client, Video, VideoPublicStatus, VideoStatus } from '@/types/database';
import { VIDEO_STATUS_MAP, VIDEO_PUBLIC_STATUS_MAP, PRIORITY_MAP } from '@/types/domain';
import type { VideoAssignEmployeeRow } from '@/lib/data/employees';
import { employeeCanBeVideoCameraman, employeeCanBeVideoEditor } from '@/lib/employees/operational-skills';
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
import { createVideoAction, updateVideoAction } from './actions';

const STATUSES = Object.keys(VIDEO_STATUS_MAP) as VideoStatus[];
const PUBLIC_STATUSES = Object.keys(VIDEO_PUBLIC_STATUS_MAP) as VideoPublicStatus[];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export function VideoFormDialog({
  video,
  clients,
  employees,
  trigger,
}: {
  video?: Video | null;
  clients: Pick<Client, 'id' | 'name'>[];
  employees: VideoAssignEmployeeRow[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isEdit = Boolean(video);

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  const dl = video?.delivery_deadline ?? '';

  const editorEmployees = employees.filter(
    (e) => employeeCanBeVideoEditor(e) || (video?.editor_id && e.id === video.editor_id),
  );
  const camEmployees = employees.filter(
    (e) => employeeCanBeVideoCameraman(e) || (video?.cameraman_id && e.id === video.cameraman_id),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la vidéo' : 'Nouvelle vidéo'}</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            setErr(null);
            setPending(true);
            try {
              const res = isEdit
                ? await updateVideoAction(video!.id, formData)
                : await createVideoAction(formData);
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
            <Label htmlFor="v-client">Client</Label>
            <select
              id="v-client"
              name="client_id"
              required
              defaultValue={video?.client_id}
              className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="v-title">Titre</Label>
            <Input id="v-title" name="title" required defaultValue={video?.title} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="v-topic">Sujet</Label>
              <Input id="v-topic" name="topic" defaultValue={video?.topic ?? ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="v-type">Type</Label>
              <Input id="v-type" name="type" defaultValue={video?.type ?? ''} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="v-brief">Brief</Label>
            <Textarea id="v-brief" name="brief" rows={3} defaultValue={video?.brief ?? ''} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="v-status">Statut production</Label>
              <select
                id="v-status"
                name="status"
                defaultValue={video?.status ?? 'idea'}
                className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {VIDEO_STATUS_MAP[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="v-pub">Statut public (portail)</Label>
              <select
                id="v-pub"
                name="public_status"
                defaultValue={video?.public_status ?? 'topic_proposed'}
                className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
              >
                {PUBLIC_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {VIDEO_PUBLIC_STATUS_MAP[s].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="v-editor">Monteur</Label>
              <select
                id="v-editor"
                name="editor_id"
                defaultValue={video?.editor_id ?? ''}
                className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
              >
                <option value="">—</option>
                {editorEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="v-cam">Caméraman</Label>
              <select
                id="v-cam"
                name="cameraman_id"
                defaultValue={video?.cameraman_id ?? ''}
                className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
              >
                <option value="">—</option>
                {camEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="v-prio">Priorité</Label>
              <select
                id="v-prio"
                name="priority"
                defaultValue={video?.priority ?? 'normal'}
                className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_MAP[p].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="v-deadline">Deadline livraison</Label>
              <Input id="v-deadline" name="delivery_deadline" type="date" defaultValue={dl} />
            </div>
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
