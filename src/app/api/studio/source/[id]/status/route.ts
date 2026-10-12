import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { getSourceVideo } from '@/lib/data/studio';
import { createClient } from '@/lib/supabase/server';
import { signedMediaUrl } from '@/lib/studio/storage';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx || !ctx.role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const source = await getSourceVideo(id);
  if (!source) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = await createClient();
  const [{ count: suggestionCount }, { data: transcriptRow }] = await Promise.all([
    supabase
      .from('clip_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('source_video_id', id)
      .eq('status', 'pending'),
    supabase.from('transcripts').select('id').eq('source_video_id', id).maybeSingle(),
  ]);

  const [proxyUrl, thumbnailUrl] = await Promise.all([
    source.proxy_storage_path ? signedMediaUrl(source.proxy_storage_path, 3600) : Promise.resolve(null),
    source.thumbnail_storage_path
      ? signedMediaUrl(source.thumbnail_storage_path, 3600)
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    id: source.id,
    status: source.status,
    progress: source.processing_progress,
    error: source.error_message,
    durationSeconds: source.duration_seconds,
    width: source.width,
    height: source.height,
    hasTranscript: Boolean(transcriptRow),
    suggestionCount: suggestionCount ?? 0,
    clipCount: source.clip_count,
    proxyUrl,
    thumbnailUrl,
  });
}
