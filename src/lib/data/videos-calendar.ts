import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { effectiveRole, hasFullOrgDataAccess } from '@/lib/auth/data-scope';
import type { VideoPublicStatus, VideoStatus } from '@/types/database';
import { effectiveClientDeliveryIso } from '@/lib/videos/video-schedule';
import {
  fetchMyVideoRoleFlagsForVideos,
  fetchVideoIdsAssignedToEmployee,
  fetchVideoIdsForAssignmentRole,
} from '@/lib/data/video-assignments';

export type CalendarVideoEventKind = 'shoot' | 'delivery';

export interface CalendarVideoEvent {
  id: string;
  videoId: string;
  kind: CalendarVideoEventKind;
  title: string;
  clientName: string;
  at: string;
  status: VideoStatus;
  public_status: VideoPublicStatus;
}

function inRange(iso: string, startMs: number, endMs: number): boolean {
  const t = new Date(iso).getTime();
  return t >= startMs && t <= endMs;
}

/**
 * Vidéos visibles pour le rôle, avec dates dans [rangeStart, rangeEnd] (bornes incluses, fin de journée OK).
 */
export async function listCalendarVideoEvents(
  ctx: AuthContext,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarVideoEvent[]> {
  if (!ctx.role) return [];
  const supabase = await createClient();
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  let q = supabase
    .from('videos')
    .select(
      'id, title, status, public_status, shooting_date, client_delivery_at, delivery_deadline, editor_id, cameraman_id, clients(name)',
    )
    .not('status', 'in', '(archived,cancelled)');

  if (hasFullOrgDataAccess(ctx) || ctx.role === 'commercial') {
    // no extra filter
  } else {
    const er = effectiveRole(ctx.role);
    const eid = ctx.employee?.id;
    if (!eid) return [];
    if (er === 'editor') {
      const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, eid);
      const parts = [`editor_id.eq.${eid}`, `cameraman_id.eq.${eid}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      q = q.or(parts.join(','));
    } else if (er === 'cameraman') {
      const fromVa = await fetchVideoIdsForAssignmentRole(supabase, eid, 'cameraman');
      const parts = [`cameraman_id.eq.${eid}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      q = q.or(parts.join(','));
    } else if (er === 'community_manager') {
      const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, eid);
      const parts = [`editor_id.eq.${eid}`, `cameraman_id.eq.${eid}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      q = q.or(parts.join(','));
    } else return [];
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const eid = ctx.employee?.id;
  const er = effectiveRole(ctx.role);
  const restrictEventKinds =
    !hasFullOrgDataAccess(ctx) &&
    ctx.role !== 'commercial' &&
    eid &&
    (er === 'editor' || er === 'cameraman' || er === 'community_manager');

  let roleByVideo: Awaited<ReturnType<typeof fetchMyVideoRoleFlagsForVideos>> | null = null;
  if (restrictEventKinds && rows.length) {
    roleByVideo = await fetchMyVideoRoleFlagsForVideos(
      supabase,
      eid,
      rows.map((row) => ({
        id: row.id as string,
        editor_id: row.editor_id as string | null | undefined,
        cameraman_id: row.cameraman_id as string | null | undefined,
      })),
    );
  }

  const out: CalendarVideoEvent[] = [];
  for (const row of rows) {
    const id = row.id as string;
    const title = row.title as string;
    const status = row.status as VideoStatus;
    const public_status = row.public_status as VideoPublicStatus;
    const clientName = (row.clients as { name?: string } | null)?.name ?? '—';
    const shoot = row.shooting_date as string | null;
    const deliveryIso = effectiveClientDeliveryIso({
      client_delivery_at: row.client_delivery_at as string | null,
      delivery_deadline: row.delivery_deadline as string | null,
    });

    const flags = roleByVideo?.get(id);
    let showShoot = true;
    let showDelivery = true;
    if (restrictEventKinds && flags && eid) {
      if (er === 'community_manager') {
        showShoot = true;
        showDelivery = true;
      } else {
        showShoot = flags.hasCameraman;
        showDelivery = flags.hasEditor;
      }
    }

    if (showShoot && shoot && inRange(shoot, startMs, endMs)) {
      out.push({
        id: `vshoot-${id}`,
        videoId: id,
        kind: 'shoot',
        title,
        clientName,
        at: shoot,
        status,
        public_status,
      });
    }
    if (showDelivery && deliveryIso && inRange(deliveryIso, startMs, endMs)) {
      out.push({
        id: `vdel-${id}`,
        videoId: id,
        kind: 'delivery',
        title,
        clientName,
        at: deliveryIso,
        status,
        public_status,
      });
    }
  }

  out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return out;
}
