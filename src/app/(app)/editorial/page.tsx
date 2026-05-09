import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listEditorialCalendarsForMonth, listOrphanVideosForMonth } from '@/lib/data/editorial';
import { listClients } from '@/lib/data/clients';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageProjects } from '@/lib/auth/capabilities';
import { VIDEO_STATUS_MAP } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { EditorialMonthNav } from './month-nav';
import { NewEditorialCalendarDialog } from './new-calendar-dialog';
import { AttachVideoSelect } from './attach-video-select';

export const metadata: Metadata = { title: 'Calendrier éditorial' };

export default async function EditorialPage({
  searchParams,
}: {
  searchParams?: Promise<{ y?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp?.y) || now.getFullYear();
  const month = Number(sp?.m) || now.getMonth() + 1;

  const ctx = await getAuthContext();
  const canEdit = canManageProjects(ctx?.role ?? null);

  const [rows, clients, orphans] = await Promise.all([
    listEditorialCalendarsForMonth({
      year,
      month,
    }),
    listClients({}, ctx),
    listOrphanVideosForMonth(year, month),
  ]);

  const supabase = await createClient();
  const clientIds = [...new Set(clients.map((c) => c.id))];
  const { data: unlinkedVideos } =
    clientIds.length > 0
      ? await supabase
          .from('videos')
          .select('id, title, client_id')
          .in('client_id', clientIds)
          .is('editorial_calendar_id', null)
          .order('title')
      : { data: [] };

  const videosByClient = new Map<string, { id: string; title: string }[]>();
  for (const v of unlinkedVideos ?? []) {
    const row = v as { id: string; title: string; client_id: string };
    const list = videosByClient.get(row.client_id) ?? [];
    list.push({ id: row.id, title: row.title });
    videosByClient.set(row.client_id, list);
  }

  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Calendrier éditorial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quotas mensuels par client, pipeline vidéo et écarts à combler.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <EditorialMonthNav year={year} month={month} />
          {canEdit ? (
            <NewEditorialCalendarDialog
              clients={clientOpts}
              year={year}
              month={month}
              trigger={
                <Button variant="primary" size="sm" className="rounded-full">
                  <Plus className="h-4 w-4" />
                  Nouveau calendrier
                </Button>
              }
            />
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <SectionCard title="Aucune ligne ce mois-ci" description="Créez un calendrier ou changez de mois.">
          <EmptyState
            title="Pas encore de quota défini"
            description="Ajoutez un calendrier mensuel pour chaque client actif avec production vidéo."
          />
        </SectionCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {rows.map((row) => (
            <SectionCard
              key={row.id}
              title={row.clients?.name ?? 'Client'}
              description={`Quota ${row.quota} vidéos · ${row.delivered} livrée(s) · ${row.in_progress} en cours`}
              action={
                row.quota_gap ? (
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    Quota incomplet
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    Sur pilotage
                  </Badge>
                )
              }
            >
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-xl border border-border/80 bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Quota</p>
                  <p className="text-lg font-semibold text-foreground">{row.quota}</p>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Livrées</p>
                  <p className="text-lg font-semibold text-foreground">{row.delivered}</p>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Reste</p>
                  <p className="text-lg font-semibold text-primary">{row.remaining}</p>
                </div>
              </div>
              {row.notes ? <p className="mt-3 text-sm text-muted-foreground">{row.notes}</p> : null}
              {canEdit ? (
                <AttachVideoSelect calendarId={row.id} videos={videosByClient.get(row.client_id) ?? []} />
              ) : null}
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline</p>
                {row.videos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune vidéo liée à ce calendrier.</p>
                ) : (
                  <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
                    {row.videos.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        <Link href={`/videos`} className="font-medium text-foreground hover:text-primary">
                          {v.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">{VIDEO_STATUS_MAP[v.status].label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <SectionCard
        title="Vidéos sans calendrier (échéance ce mois)"
        description="À rattacher pour un pilotage complet"
      >
        {orphans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune vidéo orpheline sur cette période.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
            {orphans.map((o) => (
              <li key={o.id} className="flex justify-between gap-2 px-4 py-2 text-sm">
                <span className="text-foreground">{o.title}</span>
                <span className="text-muted-foreground">{o.clientName ?? '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
