import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { listVideosWithClients } from '@/lib/data/videos';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForVideoAssign } from '@/lib/data/employees';
import { getAuthContext } from '@/lib/auth/permissions';
import { canDeleteVideo } from '@/lib/auth/capabilities';
import { VIDEO_STATUS_MAP, VIDEO_PUBLIC_STATUS_MAP, PRIORITY_MAP } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { VideoFormDialog } from './video-form-dialog';
import { VideosKanban } from './videos-kanban';
import { VideoRowActions } from './video-row-actions';

export const metadata: Metadata = { title: 'Production vidéo' };

export default async function VideosPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const view = sp?.view === 'kanban' ? 'kanban' : 'table';
  const ctx = await getAuthContext();
  const [videos, clients, employees] = await Promise.all([
    listVideosWithClients(ctx),
    listClients({}, ctx),
    listEmployeesForVideoAssign(ctx),
  ]);
  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));
  const canDelete = canDeleteVideo(ctx?.role ?? null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Vidéos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pipeline production — statuts internes et visibilité portail client.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-full border border-border p-0.5">
            <Button variant={view === 'table' ? 'primary' : 'ghost'} size="sm" className="rounded-full px-3" asChild>
              <Link href="/videos?view=table">Table</Link>
            </Button>
            <Button variant={view === 'kanban' ? 'primary' : 'ghost'} size="sm" className="rounded-full px-3" asChild>
              <Link href="/videos?view=kanban">Kanban</Link>
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

      <SectionCard title={view === 'table' ? 'Liste' : 'Pipeline'} description={`${videos.length} vidéo(s)`}>
        {videos.length === 0 ? (
          <EmptyState title="Aucune vidéo" description="Créez une fiche vidéo pour lancer la production." />
        ) : view === 'kanban' ? (
          <VideosKanban
            videos={videos}
            clients={clientOpts}
            employees={employees}
            canDelete={canDelete}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Vidéo</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Portail</th>
                  <th className="px-4 py-3 font-medium">Équipe</th>
                  <th className="px-4 py-3 font-medium">Deadline</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {videos.map((v) => {
                  const od =
                    v.delivery_deadline &&
                    v.status !== 'published' &&
                    v.status !== 'archived' &&
                    v.status !== 'cancelled' &&
                    new Date(v.delivery_deadline) < new Date();
                  return (
                    <tr key={v.id} className="bg-card/40 transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium text-foreground">{v.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.clients?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{VIDEO_STATUS_MAP[v.status].label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="primary" className="text-[10px]">
                          {VIDEO_PUBLIC_STATUS_MAP[v.public_status].label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <span className="block">{v.editor_name ? `Monteur : ${v.editor_name}` : '—'}</span>
                        <span className="block">{v.cameraman_name ? `Cam : ${v.cameraman_name}` : ''}</span>
                      </td>
                      <td className={cn('px-4 py-3 tabular-nums text-muted-foreground', od && 'font-semibold text-destructive')}>
                        {v.delivery_deadline
                          ? format(new Date(v.delivery_deadline), 'd MMM yyyy', { locale: fr })
                          : '—'}
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
