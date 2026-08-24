import type { Metadata } from 'next';
import { requireClientAuth } from '@/lib/clients/session';
import { loadClientVideos } from '@/lib/clients/workspace-data';
import { ClientPipeline, ClientSectionTitle, ClientSurface, ClientVideoList } from '@/components/client-workspace/client-ui';
import { ClientVideoActions } from '@/components/client-workspace/video-actions';

export const metadata: Metadata = { title: 'Vidéos' };

export default async function ClientVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireClientAuth();
  const { videos } = await loadClientVideos(session);
  const { filter } = await searchParams;
  const filtered =
    filter === 'validation'
      ? videos.filter((v) => v.needsValidation)
      : filter === 'production'
        ? videos.filter((v) => v.pipelineColumn === 'to_shoot' || v.pipelineColumn === 'editing')
        : filter === 'validated'
          ? videos.filter((v) => v.pipelineColumn === 'validated')
          : filter === 'delivered'
            ? videos.filter((v) => v.pipelineColumn === 'delivered')
            : videos;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ClientSurface>
        <ClientSectionTitle title="Pipeline" />
        <ClientPipeline videos={videos} />
      </ClientSurface>
      <ClientSurface>
        <ClientSectionTitle title="Tous les contenus" hint="Filtres : production, validation, validés, livrés." />
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {[
            { key: 'all', href: '/client/videos', label: 'Tous' },
            { key: 'production', href: '/client/videos?filter=production', label: 'En production' },
            { key: 'validation', href: '/client/videos?filter=validation', label: 'À valider' },
            { key: 'validated', href: '/client/videos?filter=validated', label: 'Validés' },
            { key: 'delivered', href: '/client/videos?filter=delivered', label: 'Livrés' },
          ].map((f) => {
            const active = (filter ?? 'all') === f.key;
            return (
              <a
                key={f.href}
                href={f.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'rounded-full border border-primary/40 bg-primary/[0.12] px-3 py-1 font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                    : 'rounded-full border border-white/[0.08] px-3 py-1 text-muted-foreground hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                }
              >
                {f.label}
              </a>
            );
          })}
        </div>
        <ClientVideoList
          videos={filtered}
          actions={(v) => (v.needsValidation ? <ClientVideoActions videoId={v.id} /> : null)}
        />
      </ClientSurface>
    </div>
  );
}
