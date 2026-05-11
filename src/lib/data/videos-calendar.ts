import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { effectiveRole, hasFullOrgDataAccess } from '@/lib/auth/data-scope';
import type { VideoPublicStatus, VideoStatus } from '@/types/database';
import { effectiveClientDeliveryIso } from '@/lib/videos/video-schedule';

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
    .select('id, title, status, public_status, shooting_date, client_delivery_at, delivery_deadline, clients(name)')
    .not('status', 'in', '(archived,cancelled)');

  if (hasFullOrgDataAccess(ctx) || ctx.role === 'commercial') {
    // no extra filter
  } else {
    const er = effectiveRole(ctx.role);
    const eid = ctx.employee?.id;
    if (!eid) return [];
    if (er === 'editor') q = q.or(`editor_id.eq.${eid},cameraman_id.eq.${eid}`);
    else if (er === 'cameraman') q = q.eq('cameraman_id', eid);
    else if (er === 'community_manager') q = q.or(`editor_id.eq.${eid},cameraman_id.eq.${eid}`);
    else return [];
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const out: CalendarVideoEvent[] = [];
  for (const row of data ?? []) {
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

    if (shoot && inRange(shoot, startMs, endMs)) {
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
    if (deliveryIso && inRange(deliveryIso, startMs, endMs)) {
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
