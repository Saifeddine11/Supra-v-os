'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { ShootingConfirmQueueItem } from '@/lib/data/shooting-confirmation-queue';
import { SHOOTING_POSTPONE_REASON_PRESETS } from '@/lib/videos/shooting-confirmation';
import { confirmVideoShootingDoneAction, postponeVideoShootingAction } from '@/app/(app)/videos/shooting-actions';

function snoozeKey(userId: string) {
  return `supra-shooting-confirm-snooze:${userId}`;
}

export function readShootingSnoozes(userId: string): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(snoozeKey(userId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

export function writeShootingSnooze(userId: string, videoId: string, untilMs: number) {
  const cur = readShootingSnoozes(userId);
  cur[videoId] = untilMs;
  localStorage.setItem(snoozeKey(userId), JSON.stringify(cur));
}

export function filterShootingQueueBySnooze(userId: string, queue: ShootingConfirmQueueItem[]): ShootingConfirmQueueItem[] {
  const sn = readShootingSnoozes(userId);
  const now = Date.now();
  return queue.filter((q) => !sn[q.id] || sn[q.id] <= now);
}

type Mode = 'main' | 'postpone' | 'list';

export function ShootingConfirmationModal({
  open,
  onOpenChange,
  userId,
  queue,
  onSnoozeChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  queue: ShootingConfirmQueueItem[];
  onSnoozeChange?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>('main');
  const [activeIdx, setActiveIdx] = useState(0);
  const [reasonPreset, setReasonPreset] = useState<string>('client_indisponible');
  const [reasonDetail, setReasonDetail] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [newShootLocal, setNewShootLocal] = useState('');

  const active = queue[activeIdx] ?? null;

  const resetPostpone = useCallback(() => {
    setReasonPreset('client_indisponible');
    setReasonDetail('');
    setInternalNote('');
    setNewShootLocal('');
    setMode('main');
  }, []);

  const handleLater = useCallback(() => {
    if (!active) return;
    writeShootingSnooze(userId, active.id, Date.now() + 2 * 3600_000);
    toast.message('Rappel dans 2 h pour ce tournage.');
    onSnoozeChange?.();
    if (activeIdx < queue.length - 1) {
      setActiveIdx((i) => i + 1);
    } else {
      onOpenChange(false);
    }
    router.refresh();
  }, [active, activeIdx, onOpenChange, onSnoozeChange, queue.length, router, userId]);

  const onConfirmYes = useCallback(() => {
    if (!active) return;
    startTransition(async () => {
      const res = await confirmVideoShootingDoneAction(active.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Tournage confirmé — passage en montage.');
      resetPostpone();
      if (queue.length <= 1) onOpenChange(false);
      else setActiveIdx(0);
      router.refresh();
    });
  }, [active, onOpenChange, queue.length, resetPostpone, router]);

  const onPostponeSubmit = useCallback(() => {
    if (!active) return;
    if (!newShootLocal.trim()) {
      toast.error('Indiquez la nouvelle date de tournage.');
      return;
    }
    const iso = new Date(newShootLocal).toISOString();
    startTransition(async () => {
      const fd = new FormData();
      fd.set('video_id', active.id);
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
      resetPostpone();
      onOpenChange(false);
      router.refresh();
    });
  }, [active, internalNote, newShootLocal, onOpenChange, reasonDetail, reasonPreset, resetPostpone, router]);

  const titleDate = useMemo(() => {
    if (!active?.shootingDate) return '—';
    return format(new Date(active.shootingDate), "d MMMM yyyy 'à' HH:mm", { locale: fr });
  }, [active?.shootingDate]);

  if (!open || queue.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90dvh,640px)] w-[min(100vw-1.5rem,440px)] gap-0 overflow-hidden border-border/70 p-0 sm:rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-border/60 bg-muted/20 px-5 py-4">
          <DialogTitle className="font-sans text-base font-semibold text-foreground">Confirmation de tournage</DialogTitle>
          {queue.length > 1 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {queue.length} tournages à confirmer — {mode === 'list' ? 'liste' : `n° ${activeIdx + 1}`}
            </p>
          ) : null}
        </DialogHeader>

        <div className="max-h-[min(70dvh,520px)] overflow-y-auto px-5 py-4">
          {mode === 'list' ? (
            <ul className="space-y-2">
              {queue.map((q, i) => (
                <li key={q.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-border/60 bg-card/80 px-3 py-2.5 text-left text-sm transition hover:border-primary/35"
                    onClick={() => {
                      setActiveIdx(i);
                      setMode('main');
                    }}
                  >
                    <span className="font-medium text-foreground">{q.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{q.clientName}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : mode === 'postpone' && active ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Reporter « {active.title} »</p>
              <div className="space-y-2">
                <Label>Motif</Label>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
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
                <div className="space-y-2">
                  <Label>Précision</Label>
                  <Textarea value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)} rows={2} className="resize-none text-sm" />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Nouvelle date de tournage</Label>
                <Input
                  type="datetime-local"
                  value={newShootLocal}
                  onChange={(e) => setNewShootLocal(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Note interne (optionnel)</Label>
                <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} className="resize-none text-sm" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => resetPostpone()} disabled={pending}>
                  Retour
                </Button>
                <Button type="button" variant="primary" size="sm" className="min-w-[120px]" disabled={pending} onClick={onPostponeSubmit}>
                  Enregistrer le report
                </Button>
              </div>
            </div>
          ) : active ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Le tournage de « <span className="font-medium text-foreground">{active.title}</span> » pour «{' '}
                <span className="font-medium text-foreground">{active.clientName}</span> » était prévu le{' '}
                <span className="tabular-nums text-foreground">{titleDate}</span>. Est-ce que le tournage a été fait ?
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full bg-[#FF3D0A] text-white hover:bg-[#FF450F] sm:w-auto sm:min-w-[160px]"
                  disabled={pending}
                  onClick={onConfirmYes}
                >
                  Oui, tournage fait
                </Button>
                <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={pending} onClick={() => setMode('postpone')}>
                  Non, à reprogrammer
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={pending} onClick={handleLater}>
                  Plus tard
                </Button>
                {queue.length > 1 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setMode('list')}>
                    Voir les autres ({queue.length - 1})
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShootingConfirmationHost({
  userId,
  initialQueue,
}: {
  userId: string;
  initialQueue: ShootingConfirmQueueItem[];
}) {
  const [snoozeTick, setSnoozeTick] = useState(0);
  const suppressedRef = useRef(false);

  const visible = useMemo(() => {
    void snoozeTick;
    return filterShootingQueueBySnooze(userId, initialQueue);
  }, [initialQueue, userId, snoozeTick]);

  const queueKey = useMemo(
    () =>
      visible
        .map((q) => q.id)
        .sort()
        .join(','),
    [visible],
  );

  const [open, setOpen] = useState(false);

  useEffect(() => {
    suppressedRef.current = false;
  }, [queueKey]);

  useEffect(() => {
    if (visible.length === 0) {
      setOpen(false);
      return;
    }
    if (!suppressedRef.current) {
      setOpen(true);
    }
  }, [visible.length, queueKey]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) suppressedRef.current = true;
  }, []);

  if (initialQueue.length === 0) return null;

  return (
    <ShootingConfirmationModal
      open={open && visible.length > 0}
      onOpenChange={handleOpenChange}
      userId={userId}
      queue={visible}
      onSnoozeChange={() => setSnoozeTick((t) => t + 1)}
    />
  );
}
