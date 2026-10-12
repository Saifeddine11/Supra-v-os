import type { Metadata } from 'next';
import Link from 'next/link';
import { Film, Clapperboard } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/permissions';
import { canUseStudio } from '@/lib/auth/capabilities';
import { listSourceVideos, listStudioClients } from '@/lib/data/studio';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { CONTENT_TYPE_META } from '@/lib/studio/constants';
import { humanDuration } from '@/lib/studio/time';
import { SourceStatusPill } from './studio-status-pill';
import { StudioUploadOpener } from './studio-upload-dialog';

export const metadata: Metadata = { title: 'Studio Reels' };

export default async function StudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ client?: string }>;
}) {
  const sp = await searchParams;
  const clientFilter = sp?.client?.trim() || undefined;

  const ctx = await getAuthContext();
  const canWrite = canUseStudio(ctx?.role ?? null);

  const [clients, sources] = await Promise.all([
    listStudioClients(),
    listSourceVideos({ clientId: clientFilter }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">
            Studio Reels
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transformez vos vidéos longues en Reels verticaux 9:16 — transcription, suggestions IA,
            montage et export.
          </p>
        </div>
        {canWrite ? <StudioUploadOpener clients={clients} /> : null}
      </header>

      <SectionCard
        title="Vidéos sources"
        description={`${sources.length} vidéo${sources.length > 1 ? 's' : ''}`}
      >
        {sources.length === 0 ? (
          <EmptyState
            icon={<Film className="h-8 w-8" />}
            title="Aucune vidéo source"
            description="Importez une vidéo longue (podcast, interview, tournage…) pour commencer à générer des Reels."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sources.map((s) => (
              <Link
                key={s.id}
                href={`/studio/source/${s.id}`}
                className="group flex flex-col gap-3 rounded-xl border border-border/70 bg-background/30 p-4 transition-colors hover:border-primary/45 hover:bg-primary/[0.05]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{s.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.clients?.name ?? '—'} · {CONTENT_TYPE_META[s.content_type].label}
                    </p>
                  </div>
                  <SourceStatusPill status={s.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clapperboard className="h-3.5 w-3.5" />
                    {s.clip_count} clip{s.clip_count > 1 ? 's' : ''}
                  </span>
                  <span>{s.duration_seconds ? humanDuration(s.duration_seconds * 1000) : '—'}</span>
                </div>
                {!['ready', 'failed'].includes(s.status) ? (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-border/60">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${s.processing_progress}%` }}
                    />
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
