import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { getLatestRenderJob } from '@/lib/data/studio';
import { createClient } from '@/lib/supabase/server';
import { signedMediaUrl } from '@/lib/studio/storage';
import type { Export } from '@/types/studio';

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

  const job = await getLatestRenderJob(id);

  const supabase = await createClient();
  const { data: exportRow } = await supabase
    .from('exports')
    .select('*')
    .eq('clip_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const exp = (exportRow ?? null) as Export | null;

  const downloadUrl = exp?.storage_path ? await signedMediaUrl(exp.storage_path, 3600) : null;

  return NextResponse.json({
    clipId: id,
    status: job?.status ?? null,
    progress: job?.progress ?? 0,
    error: job?.error ?? null,
    export: exp
      ? {
          id: exp.id,
          width: exp.width,
          height: exp.height,
          durationMs: exp.duration_ms,
          sizeBytes: exp.size_bytes,
          downloadUrl,
        }
      : null,
  });
}
