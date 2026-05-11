'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Client, VideoPublicStatus, VideoStatus } from '@/types/database';
import type { VideoWithClient } from '@/lib/data/videos';
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
import { cn } from '@/lib/utils/cn';
import { createVideoAction, updateVideoAction } from './actions';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { getClientColor } from '@/lib/ui/client-colors';

const STATUSES = Object.keys(VIDEO_STATUS_MAP) as VideoStatus[];
const PUBLIC_STATUSES = Object.keys(VIDEO_PUBLIC_STATUS_MAP) as VideoPublicStatus[];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const fieldSelectClass = cn(
  'flex h-10 w-full min-w-0 appearance-none rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground',
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

function dedupeEmployeesById(rows: VideoAssignEmployeeRow[]): VideoAssignEmployeeRow[] {
  const seen = new Set<string>();
  const out: VideoAssignEmployeeRow[] = [];
  for (const e of rows) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

function sortEmployeesByName(rows: VideoAssignEmployeeRow[]): VideoAssignEmployeeRow[] {
  return [...rows].sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr', { sensitivity: 'base' }));
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

function initialAssignSets(video: VideoWithClient | null | undefined): {
  editors: Set<string>;
  cameramen: Set<string>;
} {
  if (!video) return { editors: new Set(), cameramen: new Set() };
  const editors = new Set((video.editors ?? []).map((x) => x.id));
  const cameramen = new Set((video.cameramen ?? []).map((x) => x.id));
  if (video.editor_id) editors.add(video.editor_id);
  if (video.cameraman_id) cameramen.add(video.cameraman_id);
  return { editors, cameramen };
}

function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="border-b border-border/60 pb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function VideoFormDialog({
  video,
  clients,
  employees,
  trigger,
  onSaved,
}: {
  video?: VideoWithClient | null;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
  trigger: React.ReactNode;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editorSel, setEditorSel] = useState<Set<string>>(() => new Set());
  const [camSel, setCamSel] = useState<Set<string>>(() => new Set());
  const [clientSel, setClientSel] = useState(video?.client_id ?? clients[0]?.id ?? '');
  const isEdit = Boolean(video);

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  const videoRecordKey = video?.id ?? '__create__';
  /** Ne resynchroniser qu’à l’ouverture ou au changement de fiche — pas sur chaque rerender serveur (évite d’écraser Monteur/Caméraman en cours). */
  useEffect(() => {
    if (!open) return;
    setClientSel(video?.client_id ?? clients[0]?.id ?? '');
    const { editors, cameramen } = initialAssignSets(video ?? null);
    setEditorSel(new Set(editors));
    setCamSel(new Set(cameramen));
  }, [open, videoRecordKey]);

  const shootingDefault = toDatetimeLocalValue(video?.shooting_date);
  const deliveryDefault = toDatetimeLocalValue(
    video?.client_delivery_at ??
      (video?.delivery_deadline ? `${video.delivery_deadline}T12:00:00` : null)
  );

  /** Listes strictement indépendantes : aucun filtre croisé avec l’autre champ. */
  const editorOptions = useMemo(() => {
    const list = employees.filter(
      (e) =>
        employeeCanBeVideoEditor(e) ||
        (video?.editors?.some((x) => x.id === e.id) ?? false) ||
        video?.editor_id === e.id,
    );
    return sortEmployeesByName(dedupeEmployeesById(list));
  }, [employees, video?.editors, video?.editor_id]);

  const cameramanOptions = useMemo(() => {
    const list = employees.filter(
      (e) =>
        employeeCanBeVideoCameraman(e) ||
        (video?.cameramen?.some((x) => x.id === e.id) ?? false) ||
        video?.cameraman_id === e.id,
    );
    return sortEmployeesByName(dedupeEmployeesById(list));
  }, [employees, video?.cameramen, video?.cameraman_id]);

  const overlapIds = useMemo(() => {
    const out: string[] = [];
    for (const id of editorSel) {
      if (camSel.has(id)) out.push(id);
    }
    return out;
  }, [editorSel, camSel]);


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex w-[calc(100%-1.5rem)] max-w-[min(720px,calc(100vw-1.5rem))] flex-col gap-0 p-0 sm:w-[calc(100%-2rem)]',
          'max-h-[min(90vh,900px)] rounded-2xl border border-border/80 bg-card shadow-supra-glow',
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 px-5 pb-4 pt-5 sm:px-6">
          <DialogHeader className="space-y-1.5 p-0 text-left">
            <DialogTitle className="text-lg">{isEdit ? 'Modifier la vidéo' : 'Nouvelle vidéo'}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Renseignez la fiche production ; les assignations utilisent les compétences opérationnelles.
            </p>
          </DialogHeader>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
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
              onSaved?.();
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-5 sm:px-6">
            <div className="space-y-8 pb-2">
              <FormSection title="Informations générales" description="Client et contenu de la vidéo.">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="v-client">Client</Label>
                    {clientSel ? (
                      <ClientColorDot
                        hex={getClientColor(
                          clients.find((c) => c.id === clientSel) ?? { name: 'Client', color_hex: null },
                        )}
                        title={clients.find((c) => c.id === clientSel)?.name}
                      />
                    ) : null}
                  </div>
                  <select
                    id="v-client"
                    name="client_id"
                    required
                    value={clientSel}
                    onChange={(e) => setClientSel(e.target.value)}
                    className={fieldSelectClass}
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="v-topic">Sujet</Label>
                    <Input id="v-topic" name="topic" defaultValue={video?.topic ?? ''} />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="v-type">Type</Label>
                    <Input id="v-type" name="type" defaultValue={video?.type ?? ''} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="v-brief">Brief</Label>
                  <Textarea id="v-brief" name="brief" rows={4} className="min-h-[100px] resize-y" defaultValue={video?.brief ?? ''} />
                </div>
              </FormSection>

              <FormSection title="Statuts" description="Production interne, visibilité portail et priorité.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="v-status">Statut production</Label>
                    <select
                      id="v-status"
                      name="status"
                      defaultValue={video?.status ?? 'idea'}
                      className={fieldSelectClass}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {VIDEO_STATUS_MAP[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="v-pub">Statut public (portail)</Label>
                    <select
                      id="v-pub"
                      name="public_status"
                      defaultValue={video?.public_status ?? 'topic_proposed'}
                      className={fieldSelectClass}
                    >
                      {PUBLIC_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {VIDEO_PUBLIC_STATUS_MAP[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid max-w-md gap-2">
                  <Label htmlFor="v-prio">Priorité</Label>
                  <select
                    id="v-prio"
                    name="priority"
                    defaultValue={video?.priority ?? 'normal'}
                    className={fieldSelectClass}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_MAP[p].label}
                      </option>
                    ))}
                  </select>
                </div>
              </FormSection>

              <FormSection
                title="Assignation"
                description="Plusieurs monteurs et plusieurs caméramans possibles. Les listes sont indépendantes : une même personne peut être cochée dans les deux."
              >
                <input type="hidden" name="editor_ids" value={JSON.stringify([...editorSel])} />
                <input type="hidden" name="cameraman_ids" value={JSON.stringify([...camSel])} />
                <div className="grid grid-cols-1 gap-6">
                  <div className="grid min-w-0 gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Label>Monteurs</Label>
                      <span className="text-xs text-muted-foreground">
                        {editorSel.size === 0 ? 'Non assigné' : `${editorSel.size} monteur(s) assigné(s)`}
                      </span>
                    </div>
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-3">
                      {editorOptions.map((e) => (
                        <label
                          key={`ed-chk-${e.id}`}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/60"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                            checked={editorSel.has(e.id)}
                            onChange={(ev) => {
                              setEditorSel((prev) => {
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
                    {editorSel.size > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {[...editorSel]
                          .map((id) => employees.find((x) => x.id === id)?.full_name ?? id)
                          .join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Label>Caméramans</Label>
                      <span className="text-xs text-muted-foreground">
                        {camSel.size === 0 ? 'Non assigné' : `${camSel.size} caméraman(s) assigné(s)`}
                      </span>
                    </div>
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-3">
                      {cameramanOptions.map((e) => (
                        <label
                          key={`cam-chk-${e.id}`}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/60"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                            checked={camSel.has(e.id)}
                            onChange={(ev) => {
                              setCamSel((prev) => {
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
                    {camSel.size > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {[...camSel]
                          .map((id) => employees.find((x) => x.id === id)?.full_name ?? id)
                          .join(', ')}
                      </p>
                    ) : null}
                  </div>
                </div>
                {overlapIds.length > 0 ? (
                  <div className="space-y-1 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {overlapIds.map((id) => {
                      const name =
                        employees.find((e) => e.id === id)?.full_name?.trim() || 'Cette personne';
                      return (
                        <p key={id}>
                          {name} est assigné(e) comme monteur et caméraman.
                        </p>
                      );
                    })}
                  </div>
                ) : null}
              </FormSection>

              <FormSection title="Dates importantes" description="Planification tournage et engagement client.">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
                  <div className="grid min-w-0 gap-2 rounded-xl border border-border/60 bg-muted/15 p-4">
                    <Label htmlFor="v-shoot-dt">Date de tournage</Label>
                    <Input
                      id="v-shoot-dt"
                      name="shooting_datetime"
                      type="datetime-local"
                      className="w-full bg-background/80"
                      defaultValue={shootingDefault}
                    />
                    <p className="text-xs leading-snug text-muted-foreground">
                      Visible dans le calendrier équipe et le portail client.
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-2 rounded-xl border border-border/60 bg-muted/15 p-4">
                    <Label htmlFor="v-deliver-dt">Date de livraison au client</Label>
                    <Input
                      id="v-deliver-dt"
                      name="client_delivery_datetime"
                      type="datetime-local"
                      className="w-full bg-background/80"
                      defaultValue={deliveryDefault}
                    />
                    <p className="text-xs leading-snug text-muted-foreground">
                      Date prévue d’envoi ou livraison au client.
                    </p>
                  </div>
                </div>
              </FormSection>
            </div>
          </div>

          <div className="shrink-0 space-y-3 border-t border-border/80 bg-card/95 px-5 py-4 backdrop-blur-sm supports-[backdrop-filter]:bg-card/85 sm:px-6">
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" className="w-full sm:w-auto" disabled={pending}>
                {pending ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
