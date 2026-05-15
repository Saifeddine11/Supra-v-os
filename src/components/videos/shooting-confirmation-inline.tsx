'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { VideoWithClient } from '@/lib/data/videos';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { SHOOTING_POSTPONE_REASON_PRESETS } from '@/lib/videos/shooting-confirmation';
import { confirmVideoShootingDoneAction, postponeVideoShootingAction } from '@/app/(app)/videos/shooting-actions';

type Mode = 'main' | 'postpone';

export function ShootingConfirmationInline({ video, onDone }: { video: VideoWithClient; onDone?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>('main');
  const [reasonPreset, setReasonPreset] = useState<string>('client_indisponible');
  const [reasonDetail, setReasonDetail] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [newShootLocal, setNewShootLocal] = useState('');

  const titleDate = video.shooting_date
    ? format(new Date(video.shooting_date), "d MMMM yyyy 'à' HH:mm", { locale: fr })
    : '—';

  const clientName = video.clients?.name?.trim() || 'Client';

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4 dark:border-primary/30 dark:bg-primary/[0.06]">
      {mode === 'postpone' ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Reporter le tournage</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Motif</Label>
            <select
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"
              value={reasonPreset}
              onChange={(e) => setReasonPreset(e.target.value)}
            >
              {SHOOTING_POSTPONE_REASON_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {reasonPreset === 'autre' ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Précision</Label>
              <Textarea value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)} rows={2} className="resize-none text-xs" />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label className="text-xs">Nouvelle date</Label>
            <Input type="datetime-local" value={newShootLocal} onChange={(e) => setNewShootLocal(e.target.value)} className="text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note interne (optionnel)</Label>
            <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} className="resize-none text-xs" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" disabled={pending} onClick={() => setMode('main')}>
              Retour
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="h-8 bg-[#FF3D0A] text-xs text-white hover:bg-[#FF450F]"
              disabled={pending}
              onClick={() => {
                if (!newShootLocal.trim()) {
                  toast.error('Indiquez la nouvelle date de tournage.');
                  return;
                }
                const iso = new Date(newShootLocal).toISOString();
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set('video_id', video.id);
                  fd.set('reason_preset', reasonPreset);
                  fd.set('reason_detail', reasonDetail);
                  fd.set('internal_note', internalNote);
                  fd.set('new_shooting_at', iso);
                  const res = await postponeVideoShootingAction(fd);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success('Tournage reprogrammé.');
                  setMode('main');
                  onDone?.();
                  router.refresh();
                });
              }}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Le tournage de « <span className="font-medium text-foreground">{video.title}</span> » pour «{' '}
            <span className="font-medium text-foreground">{clientName}</span> » était prévu le{' '}
            <span className="tabular-nums text-foreground">{titleDate}</span>. Confirmer le résultat.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="h-9 bg-[#FF3D0A] text-xs text-white hover:bg-[#FF450F]"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await confirmVideoShootingDoneAction(video.id);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success('Tournage confirmé — passage en montage.');
                  onDone?.();
                  router.refresh();
                })
              }
            >
              Oui, tournage fait
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" disabled={pending} onClick={() => setMode('postpone')}>
              Non, reprogrammer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
