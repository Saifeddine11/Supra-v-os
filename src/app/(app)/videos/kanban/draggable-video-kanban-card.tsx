'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GripVertical } from 'lucide-react';
import type { Client } from '@/types/database';
import type { VideoAssignEmployeeRow } from '@/lib/data/employees';
import type { VideoWithClient } from '@/lib/data/videos';
import type { VideoStatus } from '@/types/database';
import { VIDEO_STATUS_MAP, VIDEO_PUBLIC_STATUS_MAP, PRIORITY_MAP } from '@/types/domain';
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
import { VideoFormDialog } from '../video-form-dialog';
import { deleteVideoAction, updateVideoStatusAction } from '../actions';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { getClientColor } from '@/lib/ui/client-colors';

export function DraggableVideoKanbanCard({
  video: v,
  clients,
  employees,
  canDelete,
  dragEnabled,
  onOpenDetail,
  highlightVideoId,
  scheduleNow,
}: {
  video: VideoWithClient;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
  canDelete: boolean;
  dragEnabled: boolean;
  onOpenDetail?: (video: VideoWithClient) => void;
  highlightVideoId?: string | null;
  scheduleNow: Date;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: v.id,
    disabled: !dragEnabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const od = isVideoDeliveryOverdue(v);
  const tone = videoWorkflowToStatusTone(v, { deliveryOverdue: Boolean(od) });
  const deliveryIso = effectiveClientDeliveryIso(v);
  const shootB = getShootingBadge(v.shooting_date, v.status, scheduleNow);
  const delB = getClientDeliveryBadge(v, scheduleNow);

  function openDetailFromCard(e: React.MouseEvent<HTMLElement>) {
    const t = e.target as HTMLElement;
    if (t.closest('a,button,select,option,input,textarea')) return;
    onOpenDetail?.(v);
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative max-w-full overflow-hidden rounded-xl border border-border/50 p-3 pl-3.5 shadow-sm',
        getStatusBlockSurface(tone, { urgentGlow: Boolean(od) }),
        highlightVideoId === v.id && 'ring-1 ring-primary/40 ring-offset-0',
        isDragging && 'relative z-[200] !transition-none',
        isDragging &&
          'scale-[1.02] cursor-grabbing opacity-[0.98] shadow-2xl ring-1 ring-primary/25 dark:shadow-black/50 dark:ring-primary/30',
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
      <div className="flex gap-1.5">
        {dragEnabled ? (
          <button
            type="button"
            aria-label="Glisser la vidéo"
            className={cn(
              'mt-0.5 flex h-8 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors',
              'hover:border-primary/35 hover:bg-muted/70 hover:text-foreground',
              'touch-none select-none',
              isDragging && 'cursor-grabbing',
              !isDragging && 'cursor-grab active:cursor-grabbing',
            )}
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <div
          role={onOpenDetail ? 'button' : undefined}
          tabIndex={onOpenDetail ? 0 : undefined}
          className={cn(
            'min-w-0 flex-1 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring/35',
            onOpenDetail && 'cursor-pointer',
            dragEnabled && 'touch-manipulation',
          )}
          onClick={onOpenDetail ? openDetailFromCard : undefined}
          onKeyDown={
            onOpenDetail
              ? (e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  onOpenDetail(v);
                }
              : undefined
          }
        >
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
            <Badge variant="outline" className={cn('text-[10px] font-medium', getVideoPublicBadgeClass(v.public_status))}>
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
                od ? 'font-semibold text-destructive' : 'text-muted-foreground',
              )}
            >
              Livraison client {format(new Date(deliveryIso), 'd MMM yyyy · HH:mm', { locale: fr })}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-muted-foreground">Livraison client : non planifié</p>
          )}
        </div>
      </div>
      <div
        className="mt-2 flex flex-wrap gap-1 border-t border-border/60 pt-2"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
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
}
