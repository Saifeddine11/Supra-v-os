import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clapperboard, FileText, Sparkles } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/permissions';
import { canUseStudio } from '@/lib/auth/capabilities';
import {
  getSourceVideo,
  getTranscript,
  listClips,
  listSuggestions,
} from '@/lib/data/studio';
import { SectionCard } from '@/components/shared/section-card';
import { CONTENT_TYPE_META } from '@/lib/studio/constants';
import { humanDuration, msToTimecode } from '@/lib/studio/time';
import { SourceStatusPill, ClipStatusPill } from '../../studio-status-pill';
import { SourceProcessingPanel } from './source-processing-panel';
import { TranscriptViewer } from './transcript-viewer';
import { SuggestionsPanel } from './suggestions-panel';
import { SourceCreateClip } from './source-create-clip';

export const metadata: Metadata = { title: 'Vidéo source' };

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const source = await getSourceVideo(id);
  if (!source) notFound();

  const ctx = await getAuthContext();
  const canWrite = canUseStudio(ctx?.role ?? null);

  const [transcript, suggestions, clips] = await Promise.all([
    getTranscript(id),
    listSuggestions(id),
    listClips(id),
  ]);

  const durationMs = source.duration_seconds ? source.duration_seconds * 1000 : 0;
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/studio"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Studio Reels
        </Link>
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">
            {source.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {source.clients?.name ?? '—'} · {CONTENT_TYPE_META[source.content_type].label} ·{' '}
            {source.duration_seconds ? humanDuration(durationMs) : 'durée inconnue'}
            {source.width ? ` · ${source.width}×${source.height}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SourceStatusPill status={source.status} />
          {canWrite && source.status === 'ready' ? (
            <SourceCreateClip sourceId={id} durationMs={durationMs} mode={source.workflow_mode} />
          ) : null}
        </div>
      </header>

      {source.status !== 'ready' ? (
        <SourceProcessingPanel
          sourceId={id}
          initialStatus={source.status}
          initialProgress={source.processing_progress}
          initialError={source.error_message}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {source.workflow_mode === 'transcript' ? (
          <>
            <SectionCard
              title="Suggestions IA"
              description="Recommandations éditoriales — vous gardez le contrôle final."
              action={
                pendingSuggestions.length ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> {pendingSuggestions.length}
                  </span>
                ) : undefined
              }
            >
              <SuggestionsPanel sourceId={id} suggestions={suggestions} />
            </SectionCard>

            <SectionCard title="Transcription" description="Source éditable, séparée des sous-titres.">
              {transcript ? (
                <TranscriptViewer
                  segments={transcript.segments.map((s) => ({
                    id: s.id,
                    start_ms: s.start_ms,
                    end_ms: s.end_ms,
                    text: s.text,
                  }))}
                />
              ) : (
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {source.status === 'ready'
                    ? 'Aucune transcription disponible.'
                    : 'Transcription en cours…'}
                </p>
              )}
            </SectionCard>
          </>
        ) : (
          <SectionCard
            title="Mode visuel"
            description="Sélectionnez des plages de la vidéo et combinez-les en un Reel."
            className="lg:col-span-2"
          >
            <p className="text-sm text-muted-foreground">
              Ce contenu est traité comme un tournage visuel (sans analyse de dialogue). Créez un clip
              puis ajoutez plusieurs plages dans l’éditeur.
            </p>
          </SectionCard>
        )}
      </div>

      <SectionCard
        title="Clips"
        description={`${clips.length} clip${clips.length > 1 ? 's' : ''}`}
      >
        {clips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun clip pour le moment. Acceptez une suggestion ou créez un clip manuel.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {clips.map((c) => (
              <Link
                key={c.id}
                href={`/studio/clip/${c.id}`}
                className="group flex flex-col gap-2 rounded-xl border border-border/70 bg-background/30 p-4 transition-colors hover:border-primary/45 hover:bg-primary/[0.05]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-medium text-foreground">{c.title}</p>
                  <ClipStatusPill status={c.status} />
                </div>
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clapperboard className="h-3.5 w-3.5" />
                  {c.total_duration_ms ? msToTimecode(c.total_duration_ms) : '—'}
                  {c.origin === 'ai' ? ' · IA' : ''}
                </p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
