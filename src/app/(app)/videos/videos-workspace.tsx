'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import type { Client, UserRole } from '@/types/database';
import type { VideoWithClient } from '@/lib/data/videos';
import type { VideoAssignEmployeeRow } from '@/lib/data/employees';
import {
  videoStaffProductionStatusLabel,
  videoStaffPublicStatusLabel,
  videoStaffShowsSingleDeliveredBadge,
} from '@/lib/videos/video-staff-status';
import { VIDEO_DEEP_LINK_QUERY_PARAM } from '@/lib/videos/video-deep-link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { getClientColor } from '@/lib/ui/client-colors';
import { effectiveClientDeliveryIso, isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';
import {
  getClientDeliveryBadge,
  getShootingBadge,
  getVideoProductionBadgeClass,
  getVideoPublicBadgeClass,
} from '@/lib/ui/status-colors';
import { videoCadreurTableCell, videoMonteurTableCell } from '@/lib/videos/video-assignee-labels';
import { VideoRowActions } from './video-row-actions';
import { VideosKanban } from './videos-kanban';
import { VideoDetailDialog } from './video-detail-dialog';
import { videoShowsShootingConfirmBadge } from '@/lib/videos/shooting-confirmation';
import { getVideoDetailForViewerAction } from './actions';

export function VideosWorkspace({
  view,
  rows,
  clients,
  employees,
  canDelete,
  canMutateVideo,
  allowKanbanDrag,
  scheduleNowIso,
  viewerRole,
  viewerEmployeeId,
}: {
  view: 'table' | 'kanban';
  rows: VideoWithClient[];
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
  canDelete: boolean;
  canMutateVideo: boolean;
  allowKanbanDrag: boolean;
  scheduleNowIso: string;
  viewerRole: UserRole | null;
  viewerEmployeeId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<VideoWithClient | null>(null);
  const scheduleNow = useMemo(() => new Date(scheduleNowIso), [scheduleNowIso]);

  const videoIdFromUrl = (searchParams.get(VIDEO_DEEP_LINK_QUERY_PARAM) ?? '').trim();
  const rowIdSig = useMemo(() => rows.map((r) => r.id).join(','), [rows]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const replaceQueryKeepingRest = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString());
      mutate(p);
      const next = p.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearVideoIdFromUrl = useCallback(() => {
    replaceQueryKeepingRest((p) => {
      p.delete(VIDEO_DEEP_LINK_QUERY_PARAM);
    });
  }, [replaceQueryKeepingRest]);

  const openDetail = useCallback(
    (v: VideoWithClient) => {
      setDetail(v);
      replaceQueryKeepingRest((p) => {
        p.set(VIDEO_DEEP_LINK_QUERY_PARAM, v.id);
      });
    },
    [replaceQueryKeepingRest],
  );

  const closeDetail = useCallback(() => {
    setDetail(null);
    clearVideoIdFromUrl();
  }, [clearVideoIdFromUrl]);

  /** ?videoId= : ouvrir la fiche (données liste ou fetch serveur sécurisé). */
  useEffect(() => {
    if (!videoIdFromUrl) {
      return;
    }

    const local = rowsRef.current.find((r) => r.id === videoIdFromUrl);
    if (local) {
      setDetail((prev) => (prev?.id === local.id ? prev : local));
      return;
    }

    let cancelled = false;
    void (async () => {
      const res = await getVideoDetailForViewerAction(videoIdFromUrl);
      if (cancelled) return;
      if (res.ok && res.data) {
        setDetail((prev) => (prev?.id === res.data!.id ? prev : res.data!));
      } else {
        const msg =
          !res.ok && res.error && !res.error.toLowerCase().includes('introuvable')
            ? res.error
            : 'Vidéo introuvable';
        toast.error(msg);
        setDetail(null);
        const p = new URLSearchParams(searchParamsRef.current.toString());
        p.delete(VIDEO_DEEP_LINK_QUERY_PARAM);
        const next = p.toString();
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [videoIdFromUrl, rowIdSig, pathname, router]);

  useEffect(() => {
    if (!detail?.id || view !== 'table') return;
    if (searchParams.get(VIDEO_DEEP_LINK_QUERY_PARAM) !== detail.id) return;
    const el = document.querySelector(`[data-video-row="${detail.id}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [detail?.id, view, searchParams]);

  const dialog = detail ? (
    <VideoDetailDialog
      video={detail}
      open
      onOpenChange={(o) => {
        if (!o) closeDetail();
      }}
      clients={clients}
      employees={employees}
      canDelete={canDelete}
      canMutateVideo={canMutateVideo}
      scheduleNow={scheduleNow}
      viewerRole={viewerRole}
      viewerEmployeeId={viewerEmployeeId}
    />
  ) : null;

  if (view === 'kanban') {
    return (
      <>
        <VideosKanban
          videos={rows}
          clients={clients}
          employees={employees}
          canDelete={canDelete}
          onOpenDetail={openDetail}
          highlightVideoId={detail?.id ?? null}
          allowKanbanDrag={allowKanbanDrag}
          scheduleNow={scheduleNow}
          viewerRole={viewerRole}
          viewerEmployeeId={viewerEmployeeId}
        />
        {dialog}
      </>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-border/80 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Vidéo</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Tournage</th>
              <th className="px-4 py-3 font-medium">Livraison client</th>
              <th className="px-4 py-3 font-medium">Statut prod.</th>
              <th className="px-4 py-3 font-medium">Portail</th>
              <th className="px-4 py-3 font-medium">Monteur</th>
              <th className="px-4 py-3 font-medium">Cadreur</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((v) => {
              const deliveryIso = effectiveClientDeliveryIso(v);
              const od = isVideoDeliveryOverdue(v);
              const shootBadge = getShootingBadge(v.shooting_date, v.status, scheduleNow);
              const delBadge = getClientDeliveryBadge(v, scheduleNow);
              const highlighted = detail?.id === v.id;
              return (
                <tr
                  key={v.id}
                  data-video-row={v.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ouvrir le détail : ${v.title}`}
                  className={cn(
                    'cursor-pointer bg-card/40 transition-colors hover:bg-muted/50',
                    od && 'bg-red-500/[0.04] dark:bg-red-500/[0.06]',
                    highlighted && 'bg-primary/[0.06] ring-1 ring-primary/35 dark:bg-primary/[0.09]',
                  )}
                  onClick={(e) => {
                    const t = e.target as HTMLElement;
                    if (t.closest('button,a,select,input')) return;
                    openDetail(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    openDetail(v);
                  }}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{v.title}</span>
                      {videoShowsShootingConfirmBadge(v, scheduleNow, viewerRole, viewerEmployeeId) ? (
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/[0.08] text-[10px] font-semibold text-primary"
                        >
                          Tournage à confirmer
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {v.clients?.name ? (
                      <span className="inline-flex items-center gap-2">
                        <ClientColorDot
                          hex={getClientColor({ name: v.clients.name, color_hex: v.clients.color_hex })}
                          title={v.clients.name}
                        />
                        {v.clients.name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {v.shooting_date
                          ? format(new Date(v.shooting_date), 'd MMM yyyy · HH:mm', { locale: fr })
                          : '—'}
                      </span>
                      <Badge variant="outline" className={cn('w-fit text-[10px] font-medium', shootBadge.className)}>
                        {shootBadge.label}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <span
                        className={cn(
                          'tabular-nums text-xs text-muted-foreground',
                          od && 'font-semibold text-destructive',
                        )}
                      >
                        {deliveryIso ? format(new Date(deliveryIso), 'd MMM yyyy · HH:mm', { locale: fr }) : '—'}
                      </span>
                      <Badge variant="outline" className={cn('w-fit text-[10px] font-medium', delBadge.className)}>
                        {delBadge.label}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3">
                    {videoStaffShowsSingleDeliveredBadge(v.status, v.public_status) ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] font-medium', getVideoPublicBadgeClass(v.public_status))}
                      >
                        {videoStaffPublicStatusLabel(v.public_status)}
                      </Badge>
                    )}
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-muted-foreground">{videoMonteurTableCell(v)}</td>
                  <td
                    className="max-w-[200px] px-4 py-3 text-xs text-muted-foreground"
                    title={
                      v.editors.some((e) => v.cameramen.some((c) => c.id === e.id))
                        ? 'Certaines personnes sont à la fois monteurs et caméramans sur cette vidéo.'
                        : undefined
                    }
                  >
                    {videoCadreurTableCell(v)}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <VideoRowActions video={v} clients={clients} employees={employees} canDelete={canDelete} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dialog}
    </>
  );
}
