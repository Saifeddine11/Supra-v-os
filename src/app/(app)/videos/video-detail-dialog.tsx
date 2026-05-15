'use client';

import { useEffect, useState, useTransition } from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { Client, UserRole, VideoPublicStatus, VideoStatus } from '@/types/database';
import type { VideoWithClient } from '@/lib/data/videos';
import type { VideoAssignEmployeeRow } from '@/lib/data/employees';
import { VIDEO_STATUS_MAP, VIDEO_PUBLIC_STATUS_MAP, PRIORITY_MAP } from '@/types/domain';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { getClientColor } from '@/lib/ui/client-colors';
import { effectiveClientDeliveryIso, isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';
import { getVideoProductionBadgeClass, getVideoPublicBadgeClass } from '@/lib/ui/status-colors';
import { VideoFormDialog } from './video-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  deleteVideoAction,
  getLinkedProductionTaskIdForVideoAction,
  updateVideoStatusAction,
} from './actions';
import { ShootingConfirmationInline } from '@/components/videos/shooting-confirmation-inline';
import { videoShowsShootingConfirmBadge } from '@/lib/videos/shooting-confirmation';

const STATUSES = Object.keys(VIDEO_STATUS_MAP) as VideoStatus[];
const PUBLIC_STATUSES = Object.keys(VIDEO_PUBLIC_STATUS_MAP) as VideoPublicStatus[];

function formatDt(iso: string | null | undefined, pattern: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, pattern, { locale: fr });
}

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

function scheduleAlerts(video: VideoWithClient, now: Date): string[] {
  const lines: string[] = [];
  if (!video.shooting_date) {
    lines.push('Tournage non planifié');
  } else {
    const sd = new Date(video.shooting_date);
    if (!Number.isNaN(sd.getTime())) {
      if (isToday(sd)) lines.push('Tournage aujourd’hui');
      else if (isTomorrow(sd)) lines.push('Tournage demain');
    }
  }
  const delIso = effectiveClientDeliveryIso(video);
  if (!delIso) {
    lines.push('Livraison non planifiée');
  }
  if (isVideoDeliveryOverdue(video)) {
    lines.push('Livraison client en retard');
  }
  return lines;
}

export function VideoDetailDialog({
  video,
  open,
  onOpenChange,
  clients,
  employees,
  canDelete,
  canMutateVideo,
  scheduleNow,
  viewerRole,
  viewerEmployeeId,
}: {
  video: VideoWithClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
  canDelete: boolean;
  canMutateVideo: boolean;
  scheduleNow: Date;
  viewerRole: UserRole | null;
  viewerEmployeeId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const deliveryIso = effectiveClientDeliveryIso(video);
  const od = isVideoDeliveryOverdue(video);
  const alerts = scheduleAlerts(video, scheduleNow);
  const showShootingConfirm = videoShowsShootingConfirmBadge(
    video,
    scheduleNow,
    viewerRole,
    viewerEmployeeId,
  );
  const clientRow = clients.find((c) => c.id === video.client_id);
  const clientHex = clientRow
    ? getClientColor(clientRow)
    : video.clients?.name
      ? getClientColor({ name: video.clients.name, color_hex: video.clients.color_hex })
      : null;

  useEffect(() => {
    if (!open) {
      setLinkedTaskId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await getLinkedProductionTaskIdForVideoAction(video.id);
      if (cancelled) return;
      if (res.ok) setLinkedTaskId(res.data?.taskId ?? null);
      else setLinkedTaskId(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, video.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'max-h-[min(90vh,900px)] w-[calc(100vw-24px)] gap-0 overflow-y-auto rounded-[24px] border-border/70 p-0 sm:max-w-[760px]',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/60 px-5 pb-4 pt-5 sm:gap-4 sm:px-6">
          <div className="min-w-0 flex-1 pr-2">
            <DialogTitle className="text-left text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
              {video.title}
            </DialogTitle>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:max-w-[min(100%,320px)]">
            <Badge
              variant="outline"
              className={cn(
                'border-border/80 text-[11px] font-medium',
                getVideoProductionBadgeClass(video.status, video.public_status, {
                  deliveryOverdue: od,
                  video,
                }),
              )}
            >
              {VIDEO_STATUS_MAP[video.status].label}
            </Badge>
            <Badge
              variant="outline"
              className={cn('border-border/80 text-[11px] font-medium', getVideoPublicBadgeClass(video.public_status))}
            >
              {VIDEO_PUBLIC_STATUS_MAP[video.public_status].label}
            </Badge>
            <Badge variant="outline" className="border-border/80 text-[11px] font-medium" style={{ color: PRIORITY_MAP[video.priority].color }}>
              {PRIORITY_MAP[video.priority].label}
            </Badge>
            <DialogClose
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </DialogClose>
          </div>
        </header>

        <div className="space-y-5 px-5 py-4 sm:px-6">
          {showShootingConfirm ? <ShootingConfirmationInline video={video} /> : null}

          {alerts.length ? (
            <div className="space-y-1.5 rounded-xl border border-orange-500/25 bg-orange-500/[0.06] px-3 py-2.5 dark:bg-orange-500/[0.08]">
              {alerts.map((line) => (
                <p key={line} className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          <section className="grid gap-3 rounded-xl border border-border/50 bg-muted/15 p-3 dark:bg-muted/10 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</h3>
              <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-foreground">
                {clientHex && video.clients?.name ? (
                  <ClientColorDot hex={clientHex} size="sm" title={video.clients.name} />
                ) : null}
                {video.clients?.name ?? '—'}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sujet</h3>
              <p className="mt-1.5 text-sm text-foreground">{video.topic?.trim() ? video.topic : '—'}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</h3>
              <p className="mt-1.5 text-sm text-foreground">{video.type?.trim() ? video.type : '—'}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Format / plateforme</h3>
              <p className="mt-1.5 text-sm text-foreground">
                {[video.format, video.platform].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Durée</h3>
              <p className="mt-1.5 text-sm tabular-nums text-foreground">{formatDuration(video.duration_seconds)}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tournage</h3>
              <p className="mt-1.5 text-sm tabular-nums text-foreground">
                {video.shooting_date ? format(new Date(video.shooting_date), "d MMMM yyyy 'à' HH:mm", { locale: fr }) : '—'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Livraison client</h3>
              <p
                className={cn(
                  'mt-1.5 text-sm tabular-nums text-foreground',
                  od && 'font-semibold text-destructive',
                )}
              >
                {deliveryIso ? format(new Date(deliveryIso), "d MMMM yyyy 'à' HH:mm", { locale: fr }) : '—'}
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Équipe</h3>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Monteurs</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {video.editors?.length ? (
                    video.editors.map((e) => (
                      <Badge key={e.id} variant="outline" className="font-normal">
                        {e.full_name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cadreurs</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {video.cameramen?.length ? (
                    video.cameramen.map((e) => (
                      <Badge key={e.id} variant="outline" className="font-normal">
                        {e.full_name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brief</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {video.brief?.trim() ? video.brief : 'Aucun brief renseigné.'}
            </p>
          </section>

          {canMutateVideo && video.client_feedback?.trim() ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Retour client (portail)</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{video.client_feedback}</p>
            </section>
          ) : null}

          <section className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <span className="font-medium uppercase tracking-wide">Création</span>
              <p className="mt-0.5 tabular-nums text-foreground">{formatDt(video.created_at, "d MMM yyyy 'à' HH:mm")}</p>
            </div>
            <div>
              <span className="font-medium uppercase tracking-wide">Dernière modification</span>
              <p className="mt-0.5 tabular-nums text-foreground">{formatDt(video.updated_at, "d MMM yyyy 'à' HH:mm")}</p>
            </div>
          </section>

          <section className="space-y-2 rounded-xl border border-border/50 bg-card/40 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Liens</h3>
            <p className="text-sm text-foreground">
              {linkedTaskId
                ? 'Une tâche de production est liée à cette vidéo (synchronisée avec le pipeline).'
                : 'Aucune tâche liée en base pour cette vidéo.'}
            </p>
            {video.editorial_calendar_id ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Calendrier éditorial : </span>
                <Link href="/editorial" className="font-medium text-primary underline-offset-4 hover:underline">
                  Voir le calendrier
                </Link>
              </p>
            ) : null}
          </section>

          {canMutateVideo ? (
            <section className="space-y-3 border-t border-border/60 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statuts</h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="grid flex-1 gap-1.5">
                  <label className="text-xs text-muted-foreground" htmlFor={`vd-status-${video.id}`}>
                    Production
                  </label>
                  <select
                    id={`vd-status-${video.id}`}
                    className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
                    value={video.status}
                    disabled={pending}
                    onChange={(e) => {
                      const s = e.target.value as VideoStatus;
                      startTransition(async () => {
                        await updateVideoStatusAction(video.id, s);
                        router.refresh();
                      });
                    }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {VIDEO_STATUS_MAP[s].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid flex-1 gap-1.5">
                  <label className="text-xs text-muted-foreground" htmlFor={`vd-pub-${video.id}`}>
                    Portail
                  </label>
                  <select
                    id={`vd-pub-${video.id}`}
                    className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
                    value={video.public_status}
                    disabled={pending}
                    onChange={(e) => {
                      const pub = e.target.value as VideoPublicStatus;
                      startTransition(async () => {
                        await updateVideoStatusAction(video.id, video.status, pub);
                        router.refresh();
                      });
                    }}
                  >
                    {PUBLIC_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {VIDEO_PUBLIC_STATUS_MAP[s].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          ) : null}

          <section className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
            {canMutateVideo ? (
              <VideoFormDialog
                video={video}
                clients={clients}
                employees={employees}
                onSaved={() => onOpenChange(false)}
                trigger={
                  <Button type="button" variant="primary" className="rounded-full">
                    Modifier
                  </Button>
                }
              />
            ) : null}
            {linkedTaskId ? (
              <Button variant="outline" className="rounded-full" asChild>
                <Link href="/tasks">Ouvrir la tâche liée</Link>
              </Button>
            ) : null}
            {canDelete ? (
              <ConfirmDialog
                title="Supprimer cette vidéo ?"
                description="Irréversible. Réservé admin / chef de projet."
                confirmLabel="Supprimer"
                onConfirm={() =>
                  startTransition(async () => {
                    await deleteVideoAction(video.id);
                    onOpenChange(false);
                    router.refresh();
                  })
                }
              >
                <Button type="button" variant="outline" className="rounded-full text-destructive">
                  Supprimer
                </Button>
              </ConfirmDialog>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
