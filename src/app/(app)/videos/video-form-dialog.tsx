'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
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

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

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
  const [editorSel, setEditorSel] = useState('');
  const [camSel, setCamSel] = useState('');
  const isEdit = Boolean(video);

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setEditorSel(video?.editor_id ?? '');
    setCamSel(video?.cameraman_id ?? '');
  }, [open, video?.id, video?.editor_id, video?.cameraman_id]);

  const shootingDefault = toDatetimeLocalValue(video?.shooting_date);
  const deliveryDefault = toDatetimeLocalValue(
    video?.client_delivery_at ??
      (video?.delivery_deadline ? `${video.delivery_deadline}T12:00:00` : null)
  );

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
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            setPending(true);
            const form = e.currentTarget;
            const fd = new FormData(form);
            const shootLocal = String(fd.get('shooting_datetime') ?? '').trim();
            fd.delete('shooting_datetime');
            fd.set('shooting_at', shootLocal ? new Date(shootLocal).toISOString() : '');
            const delLocal = String(fd.get('client_delivery_datetime') ?? '').trim();
            fd.delete('client_delivery_datetime');
            fd.set('client_delivery_at', delLocal ? new Date(delLocal).toISOString() : '');
            try {
              const res = isEdit ? await updateVideoAction(video!.id, fd) : await createVideoAction(fd);
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
                value={editorSel}
                onChange={(ev) => setEditorSel(ev.target.value)}
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
                value={camSel}
                onChange={(ev) => setCamSel(ev.target.value)}
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
          {editorSel && camSel && editorSel === camSel ? (
            <p className="text-xs text-muted-foreground">
              Cette personne est assignée comme monteur et caméraman.
            </p>
          ) : null}
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
          </div>

          <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:col-span-2">
            <Label htmlFor="v-shoot-dt">Date de tournage</Label>
            <Input
              id="v-shoot-dt"
              name="shooting_datetime"
              type="datetime-local"
              defaultValue={shootingDefault}
            />
            <p className="text-xs text-muted-foreground">
              Cette date apparaîtra dans le calendrier équipe et dans le portail client.
            </p>
          </div>

          <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:col-span-2">
            <Label htmlFor="v-deliver-dt">Date de livraison au client</Label>
            <Input
              id="v-deliver-dt"
              name="client_delivery_datetime"
              type="datetime-local"
              defaultValue={deliveryDefault}
            />
            <p className="text-xs text-muted-foreground">
              Cette date indique au client quand la vidéo doit être livrée ou envoyée en validation. Les heures sont
              enregistrées en précision complète (fuseau du navigateur).
            </p>
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
