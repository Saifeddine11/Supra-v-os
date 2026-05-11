import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { endOfWeek, format, isWithinInterval, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { listVideosWithClients } from '@/lib/data/videos';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForVideoAssign } from '@/lib/data/employees';
import { getAuthContext } from '@/lib/auth/permissions';
import { canDeleteVideo } from '@/lib/auth/capabilities';
import { VIDEO_STATUS_MAP, VIDEO_PUBLIC_STATUS_MAP } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { VideoFormDialog } from './video-form-dialog';
import { VideosKanban } from './videos-kanban';
import { VideoRowActions } from './video-row-actions';
import { effectiveClientDeliveryIso, isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';
import { videoCadreurTableCell, videoMonteurTableCell } from '@/lib/videos/video-assignee-labels';
import {
  getClientDeliveryBadge,
  getShootingBadge,
  getVideoProductionBadgeClass,
  getVideoPublicBadgeClass,
} from '@/lib/ui/status-colors';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { getClientColor } from '@/lib/ui/client-colors';

export const metadata: Metadata = { title: 'Production vidéo' };

function videosHref(opts: { view: 'table' | 'kanban'; filter?: string; client?: string }): string {
  const p = new URLSearchParams();
  p.set('view', opts.view);
  if (opts.filter) p.set('filter', opts.filter);
  if (opts.client) p.set('client', opts.client);
  return `/videos?${p.toString()}`;
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; filter?: string; client?: string }>;
}) {
  const sp = await searchParams;
  const view = sp?.view === 'kanban' ? 'kanban' : 'table';
  const filter = sp?.filter;
  const clientFilter = sp?.client?.trim() || null;
  const ctx = await getAuthContext();
  const [videos, clients, employees] = await Promise.all([
    listVideosWithClients(ctx),
    listClients({}, ctx),
    listEmployeesForVideoAssign(ctx),
  ]);
  const clientOpts = clients.map((c) => ({
    id: c.id,
    name: c.name,
    color_hex: c.color_hex,
    color_label: c.color_label,
  }));
  const canDelete = canDeleteVideo(ctx?.role ?? null);

  const scheduleNow = new Date();
  const weekStart = startOfWeek(scheduleNow, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(scheduleNow, { weekStartsOn: 1 });

  let rows = videos;
  if (clientFilter) {
    rows = rows.filter((v) => v.client_id === clientFilter);
  }
  if (filter === 'overdue') {
    rows = rows.filter((v) => isVideoDeliveryOverdue(v));
  }
  if (filter === 'shoot_week') {
    rows = rows.filter(
      (v) =>
        v.shooting_date &&
        isWithinInterval(new Date(v.shooting_date), { start: weekStart, end: weekEnd })
    );
  }
  if (filter === 'delivery_week') {
    rows = rows.filter((v) => {
      const iso = effectiveClientDeliveryIso(v);
      return iso && isWithinInterval(new Date(iso), { start: weekStart, end: weekEnd });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Vidéos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pipeline production — tournage, livraison client, statuts internes et portail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-full border border-border p-0.5">
            <Button variant={view === 'table' ? 'primary' : 'ghost'} size="sm" className="rounded-full px-3" asChild>
              <Link
                href={videosHref({
                  view: 'table',
                  filter: filter ?? undefined,
                  client: clientFilter ?? undefined,
                })}
              >
                Table
              </Link>
            </Button>
            <Button variant={view === 'kanban' ? 'primary' : 'ghost'} size="sm" className="rounded-full px-3" asChild>
              <Link
                href={videosHref({
                  view: 'kanban',
                  filter: filter ?? undefined,
                  client: clientFilter ?? undefined,
                })}
              >
                Kanban
              </Link>
            </Button>
          </div>
          <VideoFormDialog
            clients={clientOpts}
            employees={employees}
            trigger={
              <Button variant="primary" className="rounded-full">
                <Plus className="h-4 w-4" />
                Nouvelle vidéo
              </Button>
            }
          />
        </div>
      </div>

      <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
        <Button variant={!filter && !clientFilter ? 'primary' : 'outline'} size="sm" className="rounded-full" asChild>
          <Link href={videosHref({ view })}>Tout</Link>
        </Button>
        <Button variant={filter === 'shoot_week' ? 'primary' : 'outline'} size="sm" className="rounded-full" asChild>
          <Link href={videosHref({ view, filter: 'shoot_week', client: clientFilter ?? undefined })}>
            Tournage cette semaine
          </Link>
        </Button>
        <Button variant={filter === 'delivery_week' ? 'primary' : 'outline'} size="sm" className="rounded-full" asChild>
          <Link href={videosHref({ view, filter: 'delivery_week', client: clientFilter ?? undefined })}>
            Livraison cette semaine
          </Link>
        </Button>
        <Button variant={filter === 'overdue' ? 'primary' : 'outline'} size="sm" className="rounded-full" asChild>
          <Link href={videosHref({ view, filter: 'overdue', client: clientFilter ?? undefined })}>
            En retard (livraison)
          </Link>
        </Button>
        {clients.map((c) => (
          <Button
            key={c.id}
            variant={clientFilter === c.id ? 'primary' : 'outline'}
            size="sm"
            className="max-w-[160px] truncate rounded-full"
            asChild
          >
            <Link href={videosHref({ view, client: c.id, filter: filter ?? undefined })} title={c.name}>
              {c.name}
            </Link>
          </Button>
        ))}
        {clientFilter ? (
          <Button variant="ghost" size="sm" className="rounded-full" asChild>
            <Link href={videosHref({ view, filter: filter ?? undefined })}>Effacer client</Link>
          </Button>
        ) : null}
      </div>

      <SectionCard title={view === 'table' ? 'Liste' : 'Pipeline'} description={`${rows.length} vidéo(s) affichée(s)`}>
        {videos.length === 0 ? (
          <EmptyState title="Aucune vidéo" description="Créez une fiche vidéo pour lancer la production." />
        ) : rows.length === 0 ? (
          <EmptyState title="Aucun résultat" description="Modifiez les filtres pour voir d’autres vidéos." />
        ) : view === 'kanban' ? (
          <VideosKanban videos={rows} clients={clientOpts} employees={employees} canDelete={canDelete} />
        ) : (
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
                  return (
                    <tr
                      key={v.id}
                      className={cn(
                        'bg-card/40 transition-colors hover:bg-muted/50',
                        od && 'bg-red-500/[0.04] dark:bg-red-500/[0.06]',
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{v.title}</td>
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
                            {deliveryIso
                              ? format(new Date(deliveryIso), 'd MMM yyyy · HH:mm', { locale: fr })
                              : '—'}
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
                          {VIDEO_STATUS_MAP[v.status].label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-medium', getVideoPublicBadgeClass(v.public_status))}
                        >
                          {VIDEO_PUBLIC_STATUS_MAP[v.public_status].label}
                        </Badge>
                      </td>
                      <td className="max-w-[220px] px-4 py-3 text-xs text-muted-foreground">
                        {videoMonteurTableCell(v)}
                      </td>
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
                      <td className="px-4 py-3 text-right">
                        <VideoRowActions video={v} clients={clientOpts} employees={employees} canDelete={canDelete} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
