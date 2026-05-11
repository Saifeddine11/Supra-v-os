'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Client } from '@/types/database';
import type { VideoAssignEmployeeRow } from '@/lib/data/employees';
import { VIDEO_KANBAN_COLUMNS, VIDEO_STATUS_MAP, VIDEO_PUBLIC_STATUS_MAP, PRIORITY_MAP } from '@/types/domain';
import type { VideoWithClient } from '@/lib/data/videos';
import type { VideoStatus } from '@/types/database';
import { effectiveClientDeliveryIso, isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';
import { videoKanbanAssigneeSummary } from '@/lib/videos/video-assignee-labels';
import { cn } from '@/lib/utils/cn';
import { getStatusBlockSurface, videoWorkflowToStatusTone } from '@/lib/ui/status-block-tone';
import {
  getClientDeliveryBadge,
  getShootingBadge,
  getVideoProductionBadgeClass,
  getVideoPublicBadgeClass,
} from '@/lib/ui/status-colors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { VideoFormDialog } from './video-form-dialog';
import { deleteVideoAction, updateVideoStatusAction } from './actions';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { getClientColor } from '@/lib/ui/client-colors';

const TERMINAL: VideoStatus[] = ['archived', 'cancelled'];

export function VideosKanban({
  videos,
  clients,
  employees,
  canDelete,
}: {
  videos: VideoWithClient[];
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const columns = [
    ...VIDEO_KANBAN_COLUMNS.map((c) => ({
      key: c.key,
      label: c.label,
      color: c.color,
      statuses: c.statuses,
    })),
    {
      key: 'terminal',
      label: 'Archivé / Annulé',
      color: '#525252',
      statuses: TERMINAL,
    },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => {
        const items = videos.filter((v) => col.statuses.includes(v.status));
        return (
          <div
            key={col.key}
            className="flex w-[260px] shrink-0 flex-col rounded-2xl border border-border/70 bg-card/90"
          >
            <div
              className="flex items-center justify-between border-b border-border/60 px-3 py-2.5"
              style={{ borderTopColor: col.color, borderTopWidth: 3 }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{col.label}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="flex max-h-[min(70vh,720px)] flex-col gap-2 overflow-y-auto p-2">
              {items.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">Aucune vidéo</p>
              ) : (
                items.map((v) => {
                  const od = isVideoDeliveryOverdue(v);
                  const tone = videoWorkflowToStatusTone(v, { deliveryOverdue: Boolean(od) });
                  const deliveryIso = effectiveClientDeliveryIso(v);
                  const scheduleNow = new Date();
                  const shootB = getShootingBadge(v.shooting_date, v.status, scheduleNow);
                  const delB = getClientDeliveryBadge(v, scheduleNow);
                  return (
                    <article
                      key={v.id}
                      className={cn(
                        'relative overflow-hidden p-3 pl-3.5',
                        getStatusBlockSurface(tone, { urgentGlow: Boolean(od) }),
                      )}
                    >
                      {v.clients?.name ? (
                        <span
                          className="pointer-events-none absolute bottom-2.5 left-1 top-2.5 w-[3px] rounded-full opacity-95"
                          style={{
                            backgroundColor: getClientColor({
                              name: v.clients.name,
                              color_hex: v.clients.color_hex,
                            }),
                          }}
                          aria-hidden
                        />
                      ) : null}
                      <p className="text-sm font-medium text-foreground">{v.title}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {v.clients?.name ? (
                          <>
                            <ClientColorDot
                              hex={getClientColor({ name: v.clients.name, color_hex: v.clients.color_hex })}
                              size="sm"
                              title={v.clients.name}
                            />
                            <span>{v.clients.name}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-medium',
                            getVideoProductionBadgeClass(v.status, v.public_status, {
                              deliveryOverdue: od,
                              video: v,
                            }),
                          )}
                        >
                          {VIDEO_STATUS_MAP[v.status].label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-medium', getVideoPublicBadgeClass(v.public_status))}
                        >
                          {VIDEO_PUBLIC_STATUS_MAP[v.public_status].label}
                        </Badge>
                        <Badge variant="outline" className={cn('text-[10px] font-medium', shootB.className)}>
                          {shootB.label}
                        </Badge>
                        <Badge variant="outline" className={cn('text-[10px] font-medium', delB.className)}>
                          {delB.label}
                        </Badge>
                        <Badge variant="primary" className="text-[10px]">
                          {PRIORITY_MAP[v.priority].label}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">{videoKanbanAssigneeSummary(v)}</p>
                      {v.shooting_date ? (
                        <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                          Tournage {format(new Date(v.shooting_date), 'd MMM yyyy · HH:mm', { locale: fr })}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted-foreground">Tournage : non planifié</p>
                      )}
                      {deliveryIso ? (
                        <p
                          className={cn(
                            'mt-0.5 text-[11px] tabular-nums',
                            od ? 'font-semibold text-destructive' : 'text-muted-foreground'
                          )}
                        >
                          Livraison client {format(new Date(deliveryIso), 'd MMM yyyy · HH:mm', { locale: fr })}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Livraison client : non planifié</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-border/60 pt-2">
                        <select
                          className="h-8 max-w-[160px] flex-1 rounded-md border border-border bg-muted px-2 text-xs"
                          value={v.status}
                          disabled={pending}
                          onChange={(e) => {
                            const s = e.target.value as VideoStatus;
                            startTransition(async () => {
                              await updateVideoStatusAction(v.id, s);
                              router.refresh();
                            });
                          }}
                        >
                          {(Object.keys(VIDEO_STATUS_MAP) as VideoStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {VIDEO_STATUS_MAP[s].label}
                            </option>
                          ))}
                        </select>
                        <VideoFormDialog
                          video={v}
                          clients={clients}
                          employees={employees}
                          trigger={
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                              Éditer
                            </Button>
                          }
                        />
                        {canDelete ? (
                          <ConfirmDialog
                            title="Supprimer cette vidéo ?"
                            description="Action réservée admin / chef de projet."
                            confirmLabel="Supprimer"
                            onConfirm={() =>
                              startTransition(async () => {
                                await deleteVideoAction(v.id);
                                router.refresh();
                              })
                            }
                          >
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive">
                              Suppr.
                            </Button>
                          </ConfirmDialog>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
