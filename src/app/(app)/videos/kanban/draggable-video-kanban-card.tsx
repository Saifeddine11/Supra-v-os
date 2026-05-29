'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GripVertical, MoreHorizontal } from 'lucide-react';
import type { Client, UserRole } from '@/types/database';
import type { VideoAssignEmployeeRow } from '@/lib/data/employees';
import type { VideoWithClient } from '@/lib/data/videos';
import type { VideoStatus } from '@/types/database';
import { VIDEO_PUBLIC_STATUS_MAP, PRIORITY_MAP } from '@/types/domain';
import {
  videoStaffProductionStatusLabel,
  videoStaffProductionStatusSelectOptions,
  videoStaffProductionStatusSelectValue,
  videoStaffShowsSingleDeliveredBadge,
} from '@/lib/videos/video-staff-status';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { VideoFormDialog } from '../video-form-dialog';
import { deleteVideoAction, updateVideoStatusAction } from '../actions';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { getClientColor } from '@/lib/ui/client-colors';
import { videoShowsShootingConfirmBadge } from '@/lib/videos/shooting-confirmation';

function VideoCardActionsMenu({
  video: v,
  clients,
  employees,
  canDelete,
  onOpenDetail,
}: {
  video: VideoWithClient;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
  canDelete: boolean;
  onOpenDetail?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Actions vidéo"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[120] w-52" onClick={(e) => e.stopPropagation()}>
        {onOpenDetail ? (
          <DropdownMenuItem onSelect={() => onOpenDetail()}>Voir le détail</DropdownMenuItem>
        ) : null}
        <VideoFormDialog
          video={v}
          clients={clients}
          employees={employees}
          trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Modifier</DropdownMenuItem>}
        />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Changer le statut</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {(videoStaffProductionStatusSelectOptions()).map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                disabled={pending || v.status === opt.value || (opt.value === 'published' && v.status === 'validated')}
                onSelect={() => {
                  startTransition(async () => {
                    await updateVideoStatusAction(v.id, opt.value);
                    router.refresh();
                  });
                }}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
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
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => e.preventDefault()}
              >
                Supprimer
              </DropdownMenuItem>
            </ConfirmDialog>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DraggableVideoKanbanCard({
  video: v,
  clients,
  employees,
  canDelete,
  dragEnabled,
  compact = false,
  onOpenDetail,
  highlightVideoId,
  scheduleNow,
  viewerRole,
  viewerEmployeeId,
}: {
  video: VideoWithClient;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
  canDelete: boolean;
  dragEnabled: boolean;
  compact?: boolean;
  onOpenDetail?: (video: VideoWithClient) => void;
  highlightVideoId?: string | null;
  scheduleNow: Date;
  viewerRole: UserRole | null;
  viewerEmployeeId: string | null;
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
  const needsShootingConfirm = videoShowsShootingConfirmBadge(v, scheduleNow, viewerRole, viewerEmployeeId);
  const tone = videoWorkflowToStatusTone(v, { deliveryOverdue: Boolean(od) });
  const deliveryIso = effectiveClientDeliveryIso(v);
  const shootB = getShootingBadge(v.shooting_date, v.status, scheduleNow);
  const delB = getClientDeliveryBadge(v, scheduleNow);

  function openDetailFromCard(e: React.MouseEvent<HTMLElement>) {
    const t = e.target as HTMLElement;
    if (t.closest('a,button,select,option,input,textarea')) return;
    onOpenDetail?.(v);
  }

  const dragHandle = dragEnabled ? (
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
  ) : null;

  const productionBadge = (
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
      {videoStaffProductionStatusLabel(v.status)}
    </Badge>
  );

  const secondaryBadge = od ? (
    <Badge variant="outline" className={cn('text-[10px] font-medium', delB.className)}>
      {delB.label}
    </Badge>
  ) : needsShootingConfirm ? (
    <Badge
      variant="outline"
      className="border-primary/40 bg-primary/[0.08] text-[10px] font-semibold text-primary"
    >
      Tournage à confirmer
    </Badge>
  ) : (
    <Badge variant="primary" className="text-[10px]">
      {PRIORITY_MAP[v.priority].label}
    </Badge>
  );

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative shrink-0 max-w-full overflow-hidden rounded-xl border border-border/50 shadow-sm',
        compact ? 'min-h-[76px] p-2.5 pl-3' : 'min-h-[120px] p-3 pl-3.5',
        getStatusBlockSurface(tone, { urgentGlow: Boolean(od) }),
        highlightVideoId === v.id && 'ring-1 ring-primary/40 ring-offset-0',
        isDragging && 'relative z-[200] !transition-none',
        isDragging &&
          'scale-[1.02] cursor-grabbing opacity-[0.98] shadow-2xl ring-1 ring-primary/25 dark:shadow-black/50 dark:ring-primary/30',
      )}
    >
      {v.clients?.name ? (
        <span
          className="pointer-events-none absolute bottom-2 left-1 top-2 w-[3px] rounded-full opacity-95"
          style={{
            backgroundColor: getClientColor({
              name: v.clients.name,
              color_hex: v.clients.color_hex,
            }),
          }}
          aria-hidden
        />
      ) : null}

      {compact ? (
        <div className="flex items-stretch gap-1.5">
          {dragHandle}
          <div
            role={onOpenDetail ? 'button' : undefined}
            tabIndex={onOpenDetail ? 0 : undefined}
            className={cn(
              'min-w-0 flex-1 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
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
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{v.title}</p>
            {v.clients?.name ? (
              <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[12px] text-muted-foreground">
                <ClientColorDot
                  hex={getClientColor({ name: v.clients.name, color_hex: v.clients.color_hex })}
                  size="sm"
                  title={v.clients.name}
                />
                <span className="truncate">{v.clients.name}</span>
              </p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {productionBadge}
              {secondaryBadge}
            </div>
          </div>
          <div className="flex shrink-0 items-start" onPointerDown={(e) => e.stopPropagation()}>
            <VideoCardActionsMenu
              video={v}
              clients={clients}
              employees={employees}
              canDelete={canDelete}
              onOpenDetail={onOpenDetail ? () => onOpenDetail(v) : undefined}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-1.5">
            {dragHandle}
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
              <p className="text-sm font-medium leading-snug text-foreground">{v.title}</p>
              {needsShootingConfirm ? (
                <Badge
                  variant="outline"
                  className="mt-1.5 border-primary/40 bg-primary/[0.08] text-[10px] font-semibold text-primary"
                >
                  Tournage à confirmer
                </Badge>
              ) : null}
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
                {productionBadge}
                {!videoStaffShowsSingleDeliveredBadge(v.status, v.public_status) ? (
                  <Badge variant="outline" className={cn('text-[10px] font-medium', getVideoPublicBadgeClass(v.public_status))}>
                    {VIDEO_PUBLIC_STATUS_MAP[v.public_status].label}
                  </Badge>
                ) : null}
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
              value={videoStaffProductionStatusSelectValue(v.status)}
              disabled={pending}
              onChange={(e) => {
                const s = e.target.value as VideoStatus;
                startTransition(async () => {
                  await updateVideoStatusAction(v.id, s);
                  router.refresh();
                });
              }}
            >
              {videoStaffProductionStatusSelectOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
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
        </>
      )}
    </article>
  );
}
