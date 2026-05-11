import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { endOfWeek, isWithinInterval, startOfWeek } from 'date-fns';
import { listVideosWithClients } from '@/lib/data/videos';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForVideoAssign } from '@/lib/data/employees';
import { getAuthContext } from '@/lib/auth/permissions';
import { canDeleteVideo } from '@/lib/auth/capabilities';
import { videoMutationDenied } from '@/lib/auth/data-scope';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { VideoFormDialog } from './video-form-dialog';
import { VideosWorkspace } from './videos-workspace';
import { effectiveClientDeliveryIso, isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';

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
  const canMutateVideo = Boolean(ctx && !videoMutationDenied(ctx));

  const scheduleNow = new Date();
  const scheduleNowIso = scheduleNow.toISOString();
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
        ) : (
          <Suspense
            fallback={<div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">Chargement…</div>}
          >
            <VideosWorkspace
              view={view}
              rows={rows}
              clients={clientOpts}
              employees={employees}
              canDelete={canDelete}
              canMutateVideo={canMutateVideo}
              scheduleNowIso={scheduleNowIso}
            />
          </Suspense>
        )}
      </SectionCard>
    </div>
  );
}
