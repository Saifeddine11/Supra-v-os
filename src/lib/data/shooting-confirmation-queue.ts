import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import type { VideoStatus } from '@/types/database';
import type { VideoWithClient } from '@/lib/data/videos';
import { fetchAssignmentsForVideos } from '@/lib/data/video-assignments';
import {
  roleSeesShootingConfirmationFlow,
  videoNeedsShootingConfirmation,
  viewerCanRespondToShootingConfirmation,
} from '@/lib/videos/shooting-confirmation';
import { withDevTime } from '@/lib/perf/dev-time';

export type ShootingConfirmQueueItem = {
  id: string;
  title: string;
  clientName: string;
  shootingDate: string;
};

const STATUSES: VideoStatus[] = [
  'idea',
  'brief_pending',
  'brief_validated',
  'shooting_planned',
  'shooting_done',
  'rushes_received',
];

async function attachCameramenForQueueRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: (Pick<VideoWithClient, 'id' | 'cameraman_id'> & { cameramen: VideoWithClient['cameramen'] })[],
): Promise<void> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;
  const map = await fetchAssignmentsForVideos(supabase, ids);
  const empIds = new Set<string>();
  for (const r of rows) {
    if (r.cameraman_id) empIds.add(r.cameraman_id);
    const m = map.get(r.id);
    m?.cameramen.forEach((c) => empIds.add(c.id));
  }
  const nameMap = new Map<string, string>();
  if (empIds.size > 0) {
    const { data: emps, error } = await supabase.from('employees').select('id, full_name').in('id', [...empIds]);
    if (error) throw new Error(error.message);
    for (const e of emps ?? []) nameMap.set(e.id as string, String((e as { full_name: string }).full_name));
  }
  for (const r of rows) {
    let cameramen = [...(map.get(r.id)?.cameramen ?? [])];
    if (cameramen.length === 0 && r.cameraman_id) {
      cameramen = [{ id: r.cameraman_id, full_name: nameMap.get(r.cameraman_id) ?? '—' }];
    }
    r.cameramen = cameramen;
  }
}

/**
 * Vidéos dont le tournage est dû / passé et non confirmé, pour l’utilisateur courant (RLS + rôle).
 */
export async function fetchShootingConfirmationQueue(
  ctx: AuthContext,
  now: Date = new Date(),
): Promise<ShootingConfirmQueueItem[]> {
  return withDevTime('shooting confirmation queue', () => fetchShootingConfirmationQueueInner(ctx, now));
}

async function fetchShootingConfirmationQueueInner(
  ctx: AuthContext,
  now: Date,
): Promise<ShootingConfirmQueueItem[]> {
  if (!ctx.role || !ctx.employee) return [];
  if (!roleSeesShootingConfirmationFlow(ctx.role)) return [];
  if (!ctx.employee.is_active || ctx.employee.archived_at) return [];

  const supabase = await createClient();
  const nowIso = now.toISOString();

  const { data, error } = await supabase
    .from('videos')
    .select('id,title,status,shooting_date,shooting_completed_at,client_id,cameraman_id,editor_id,clients(name)')
    .not('shooting_date', 'is', null)
    .lte('shooting_date', nowIso)
    .is('shooting_completed_at', null)
    .in('status', STATUSES);

  if (error) throw new Error(error.message);

  type Row = Pick<VideoWithClient, 'id' | 'title' | 'status' | 'shooting_date' | 'shooting_completed_at' | 'client_id' | 'cameraman_id' | 'editor_id'> & {
    clients: { name: string } | null;
    cameramen: VideoWithClient['cameramen'];
  };

  const rows: Row[] = (data ?? []).map((raw) => {
    const r = raw as Omit<Row, 'cameramen'> & { clients: { name: string } | { name: string }[] | null };
    const clients =
      r.clients && !Array.isArray(r.clients) ? r.clients : Array.isArray(r.clients) ? r.clients[0] ?? null : null;
    return { ...r, clients, cameramen: [] };
  });

  await attachCameramenForQueueRows(supabase, rows);

  const out: ShootingConfirmQueueItem[] = [];
  for (const v of rows) {
    if (!videoNeedsShootingConfirmation(v, now)) continue;
    if (!viewerCanRespondToShootingConfirmation(ctx.role, ctx.employee.id, v)) continue;
    out.push({
      id: v.id,
      title: v.title,
      clientName: v.clients?.name?.trim() || 'Client',
      shootingDate: v.shooting_date as string,
    });
  }

  out.sort((a, b) => new Date(a.shootingDate).getTime() - new Date(b.shootingDate).getTime());
  return out;
}
