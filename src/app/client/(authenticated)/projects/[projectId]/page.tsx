import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireClientAuth } from '@/lib/clients/session';
import { loadClientProjectDetail } from '@/lib/clients/workspace-data';
import { formatClientDate } from '@/lib/clients/client-labels';
import {
  ClientEmpty,
  ClientSectionTitle,
  ClientSurface,
  ClientVideoList,
} from '@/components/client-workspace/client-ui';
import { ClientVideoActions } from '@/components/client-workspace/video-actions';

export const metadata: Metadata = { title: 'Projet' };

export default async function ClientProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireClientAuth();
  const detail = await loadClientProjectDetail(session, projectId);
  if (!detail) notFound();
  const { project, videos } = detail;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {project.typeLabel}
        </p>
        <h2 className="mt-1 break-words font-serif text-3xl tracking-tight text-foreground">{project.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {project.phaseLabel}
          {project.deadline ? ` · Échéance ${formatClientDate(project.deadline)}` : ''}
          {project.deliveredAt ? ` · Livré ${formatClientDate(project.deliveredAt)}` : ''}
        </p>
      </header>

      <ClientSurface>
        {project.progress != null ? (
          <>
            <ClientSectionTitle title="Avancement" />
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-primary/80" style={{ width: `${project.progress}%` }} />
            </div>
            <p className="mt-2 text-sm tabular-nums text-muted-foreground">{project.progress}%</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Statut actuel : {project.phaseLabel}.</p>
        )}
      </ClientSurface>

      <ClientSurface>
        <ClientSectionTitle title="Contenus liés" />
        {videos.length === 0 ? (
          <ClientEmpty title="Aucun contenu rattaché à ce projet pour le moment." />
        ) : (
          <ClientVideoList
            videos={videos}
            actions={(v) => (v.needsValidation ? <ClientVideoActions videoId={v.id} /> : null)}
          />
        )}
      </ClientSurface>
    </div>
  );
}
