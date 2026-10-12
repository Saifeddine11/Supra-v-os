import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/permissions';
import { canUseStudio } from '@/lib/auth/capabilities';
import { getClip, getLatestRenderJob, listBrandKits } from '@/lib/data/studio';
import { createClient } from '@/lib/supabase/server';
import { signedMediaUrl } from '@/lib/studio/storage';
import type { SubtitlePreset } from '@/types/studio';
import { ClipWorkspace } from './clip-workspace';

export const metadata: Metadata = { title: 'Éditeur Reel' };

const VALID_STYLES: SubtitlePreset[] = ['clean_minimal', 'bold_social', 'word_highlight'];

export default async function ClipEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const full = await getClip(id);
  if (!full) notFound();

  const ctx = await getAuthContext();
  const canWrite = canUseStudio(ctx?.role ?? null);

  const [proxyUrl, brandKits, latestRender] = await Promise.all([
    full.source.proxy_storage_path ? signedMediaUrl(full.source.proxy_storage_path, 3600) : null,
    listBrandKits(full.clip.client_id),
    getLatestRenderJob(id),
  ]);

  const activeTrack = full.tracks.find((t) => t.is_active) ?? full.tracks[0] ?? null;

  // Comment author names
  const authorIds = Array.from(
    new Set(full.comments.map((c) => c.author_employee_id).filter((x): x is string => Boolean(x))),
  );
  const authors: Record<string, string> = {};
  if (authorIds.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.from('employees').select('id, full_name').in('id', authorIds);
    for (const e of (data ?? []) as { id: string; full_name: string }[]) {
      authors[e.id] = e.full_name;
    }
  }

  const styleKey = (VALID_STYLES as string[]).includes(full.clip.subtitle_style)
    ? (full.clip.subtitle_style as SubtitlePreset)
    : 'clean_minimal';

  const sourceDurationMs = full.source.duration_seconds ? full.source.duration_seconds * 1000 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/studio/source/${full.clip.source_video_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Vidéo source
        </Link>
      </div>

      <ClipWorkspace
        clip={full.clip}
        sourceDurationMs={sourceDurationMs}
        sourceFps={full.source.fps ?? 30}
        proxyUrl={proxyUrl}
        segments={full.segments}
        trackId={activeTrack?.id ?? null}
        initialStyle={styleKey}
        initialCues={activeTrack?.cues ?? []}
        comments={full.comments}
        commentAuthors={authors}
        brandKits={brandKits}
        exports={full.exports}
        latestRender={
          latestRender ? { status: latestRender.status, progress: latestRender.progress } : null
        }
        canWrite={canWrite}
      />
    </div>
  );
}
