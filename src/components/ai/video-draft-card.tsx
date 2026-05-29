'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Check, Loader2, Pencil, User, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import type { AiVideoDraftPayload } from '@/lib/ai/video-draft-schema';
import {
  AI_VIDEO_DRAFT_PRIORITY,
  AI_VIDEO_PRIORITY_LABELS,
  AI_VIDEO_PRODUCTION_LABELS,
} from '@/lib/ai/video-draft-schema';
import { hrefVideosOpenDetailKanban } from '@/lib/videos/video-deep-link';
import {
  DRAFT_VALUE_MISSING,
  SUPAI_ERROR_NETWORK,
  SUPAI_ERROR_VIDEO_CREATE,
} from '@/lib/ai/supai-copy';

type VideoDraftCardProps = {
  draft: AiVideoDraftPayload;
  canCreate: boolean;
  restoredVideoId?: string | null;
  onCancel: () => void;
  onVideoCreated?: (videoId: string) => void;
};

function toDatetimeLocal(iso?: string | null): string {
  if (!iso?.trim()) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function displayOrMissing(value?: string | null): string {
  const v = value?.trim();
  return v ? v : DRAFT_VALUE_MISSING;
}

export function VideoDraftCard({
  draft,
  canCreate,
  restoredVideoId,
  onCancel,
  onVideoCreated,
}: VideoDraftCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(restoredVideoId ?? null);

  const [title, setTitle] = useState(draft.title);
  const [clientName, setClientName] = useState(draft.clientName ?? '');
  const [subject, setSubject] = useState(draft.subject ?? '');
  const [type, setType] = useState(draft.type ?? '');
  const [shootingLocal, setShootingLocal] = useState(toDatetimeLocal(draft.shootingDateIso));
  const [shootingText, setShootingText] = useState(draft.shootingDateText ?? '');
  const [deliveryLocal, setDeliveryLocal] = useState(toDatetimeLocal(draft.clientDeliveryDateIso));
  const [deliveryText, setDeliveryText] = useState(draft.clientDeliveryDateText ?? '');
  const [editorName, setEditorName] = useState(draft.editorName ?? '');
  const [cameramanName, setCameramanName] = useState(draft.cameramanName ?? '');
  const [priority, setPriority] = useState<(typeof AI_VIDEO_DRAFT_PRIORITY)[number]>(
    draft.priority ?? 'normal',
  );
  const [description, setDescription] = useState(draft.description ?? '');

  useEffect(() => {
    setTitle(draft.title);
    setClientName(draft.clientName ?? '');
    setSubject(draft.subject ?? '');
    setType(draft.type ?? '');
    setShootingLocal(toDatetimeLocal(draft.shootingDateIso));
    setShootingText(draft.shootingDateText ?? '');
    setDeliveryLocal(toDatetimeLocal(draft.clientDeliveryDateIso));
    setDeliveryText(draft.clientDeliveryDateText ?? '');
    setEditorName(draft.editorName ?? '');
    setCameramanName(draft.cameramanName ?? '');
    setPriority(draft.priority ?? 'normal');
    setDescription(draft.description ?? '');
    setEditing(false);
    if (!restoredVideoId) setCreatedId(null);
  }, [draft, restoredVideoId]);

  async function handleConfirm() {
    if (!canCreate || confirming) return;
    if (!title.trim()) {
      toast.error('Le titre est requis.');
      return;
    }

    setConfirming(true);
    try {
      const shootingDateIso = fromDatetimeLocal(shootingLocal) ?? draft.shootingDateIso;
      const clientDeliveryDateIso =
        fromDatetimeLocal(deliveryLocal) ?? draft.clientDeliveryDateIso;

      const res = await fetch('/api/ai/actions/create-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          clientName: clientName.trim() || undefined,
          subject: subject.trim() || undefined,
          type: type.trim() || undefined,
          shootingDateIso,
          clientDeliveryDateIso,
          priority,
          productionStatus: draft.productionStatus ?? 'idea',
          portalStatus: draft.portalStatus ?? 'topic_proposed',
          editorName: editorName.trim() || undefined,
          cameramanName: cameramanName.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { videoId?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? SUPAI_ERROR_VIDEO_CREATE);
        return;
      }
      if (data.videoId) {
        setCreatedId(data.videoId);
        onVideoCreated?.(data.videoId);
        toast.success('Vidéo créée');
      }
    } catch {
      toast.error(SUPAI_ERROR_NETWORK);
    } finally {
      setConfirming(false);
    }
  }

  const productionLabel =
    AI_VIDEO_PRODUCTION_LABELS[draft.productionStatus ?? 'idea'] ?? 'Idée / Brief';

  if (createdId) {
    return (
      <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
        <p className="font-medium text-foreground">Vidéo créée</p>
        <p className="mt-1 text-muted-foreground">{title}</p>
        <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
          <Link href={hrefVideosOpenDetailKanban(createdId)}>Voir la vidéo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-4 text-sm shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">
        Brouillon vidéo — confirmation requise
      </p>

      {editing ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor={`vd-title-${draft.title}`}>Titre</Label>
            <Input
              id={`vd-title-${draft.title}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`vd-client-${draft.title}`}>Client</Label>
            <Input
              id={`vd-client-${draft.title}`}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nom du client"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`vd-subject-${draft.title}`}>Sujet</Label>
            <Input
              id={`vd-subject-${draft.title}`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`vd-type-${draft.title}`}>Type</Label>
            <Input
              id={`vd-type-${draft.title}`}
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Tournage (date/heure)</Label>
            <Input
              type="datetime-local"
              value={shootingLocal}
              onChange={(e) => setShootingLocal(e.target.value)}
              className="mt-1"
            />
            <Input
              value={shootingText}
              onChange={(e) => setShootingText(e.target.value)}
              placeholder="Texte libre (ex. dimanche à 10h)"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Livraison client</Label>
            <Input
              type="datetime-local"
              value={deliveryLocal}
              onChange={(e) => setDeliveryLocal(e.target.value)}
              className="mt-1"
            />
            <Input
              value={deliveryText}
              onChange={(e) => setDeliveryText(e.target.value)}
              placeholder="Texte libre (ex. 31 mai)"
              className="mt-1.5"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Monteur</Label>
              <Input
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Cadreur</Label>
              <Input
                value={cameramanName}
                onChange={(e) => setCameramanName(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Priorité</Label>
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as (typeof AI_VIDEO_DRAFT_PRIORITY)[number])
              }
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {AI_VIDEO_DRAFT_PRIORITY.map((p) => (
                <option key={p} value={p}>
                  {AI_VIDEO_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>
        </div>
      ) : (
        <dl className="space-y-2 text-sm">
          <Row icon={Video} label="Titre" value={displayOrMissing(title)} />
          <Row icon={User} label="Client" value={displayOrMissing(clientName)} />
          <Row label="Sujet" value={displayOrMissing(subject)} />
          <Row label="Type" value={displayOrMissing(type)} />
          <Row
            icon={Calendar}
            label="Tournage"
            value={
              shootingLocal || shootingText
                ? [shootingText, shootingLocal ? new Date(shootingLocal).toLocaleString('fr-FR') : '']
                    .filter(Boolean)
                    .join(' · ') || DRAFT_VALUE_MISSING
                : DRAFT_VALUE_MISSING
            }
          />
          <Row
            icon={Calendar}
            label="Livraison client"
            value={
              deliveryLocal || deliveryText
                ? [deliveryText, deliveryLocal ? new Date(deliveryLocal).toLocaleString('fr-FR') : '']
                    .filter(Boolean)
                    .join(' · ') || DRAFT_VALUE_MISSING
                : DRAFT_VALUE_MISSING
            }
          />
          <Row label="Monteur" value={displayOrMissing(editorName)} />
          <Row label="Cadreur" value={displayOrMissing(cameramanName)} />
          <Row label="Description" value={displayOrMissing(description)} />
          <Row label="Priorité" value={AI_VIDEO_PRIORITY_LABELS[priority]} />
          <Row label="Statut initial" value={productionLabel} />
        </dl>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {editing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setEditing(false)}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Valider
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setEditing(true)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Modifier
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="rounded-full"
          disabled={!canCreate || confirming}
          onClick={() => void handleConfirm()}
        >
          {confirming ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : null}
          Confirmer la vidéo
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full text-muted-foreground"
          disabled={confirming}
          onClick={onCancel}
        >
          <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Annuler
        </Button>
      </div>

      {!canCreate ? (
        <p className="mt-2 text-xs text-destructive">
          Votre rôle ne permet pas de créer une vidéo via l’assistant.
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Video;
}) {
  return (
    <div className="flex gap-2">
      {Icon ? (
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <span className="w-3.5 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className={cn('break-words', value === 'Non renseigné' && 'text-muted-foreground')}>
          {value}
        </dd>
      </div>
    </div>
  );
}
