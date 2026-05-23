import 'server-only';

import { startOfDay } from 'date-fns';
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
import { getClientColor } from '@/lib/ui/client-colors';

export type CalendarVideoEventKind = 'shoot' | 'delivery';

export interface CalendarVideoEvent {
  id: string;
  videoId: string;
  kind: CalendarVideoEventKind;
  title: string;
  clientName: string;
  client_brand_hex: string;
  at: string;
  status: VideoStatus;
  public_status: VideoPublicStatus;
  shooting_date: string | null;
  shooting_started_at?: string | null;
  shooting_expected_end_at?: string | null;
  client_delivery_at: string | null;
  delivery_deadline: string | null;
  /** Libellé court (ex. tournage en cours). */
  shootLabel?: string;
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
      'id, title, status, public_status, shooting_date, shooting_started_at, shooting_expected_end_at, client_delivery_at, delivery_deadline, editor_id, cameraman_id, clients(name, color_hex)',
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
    const cl = row.clients as { name?: string; color_hex?: string | null } | null;
    const clientName = cl?.name ?? '—';
    const client_brand_hex = getClientColor({ name: clientName === '—' ? 'Client' : clientName, color_hex: cl?.color_hex ?? null });
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

    if (showShoot && status === 'shooting_in_progress') {
      const started = (row.shooting_started_at as string | null) ?? shoot;
      const rangeStartIso = started ?? shoot;
      const rangeEndIso =
        (row.shooting_expected_end_at as string | null) ?? new Date().toISOString();
      if (rangeStartIso) {
        const rs = startOfDay(new Date(rangeStartIso)).getTime();
        const re = startOfDay(new Date(rangeEndIso)).getTime();
        for (let t = rs; t <= re; t += 86400000) {
          const dayIso = new Date(t + 12 * 3600000).toISOString();
          if (!inRange(dayIso, startMs, endMs)) continue;
          out.push({
            id: `vshoot-ip-${id}-${t}`,
            videoId: id,
            kind: 'shoot',
            title,
            clientName,
            client_brand_hex,
            at: dayIso,
            status,
            public_status,
            shooting_date: shoot,
            shooting_started_at: row.shooting_started_at as string | null,
            shooting_expected_end_at: row.shooting_expected_end_at as string | null,
            client_delivery_at: row.client_delivery_at as string | null,
            delivery_deadline: row.delivery_deadline as string | null,
            shootLabel: 'Tournage en cours',
          });
        }
      }
    } else if (showShoot && shoot && inRange(shoot, startMs, endMs)) {
      out.push({
        id: `vshoot-${id}`,
        videoId: id,
        kind: 'shoot',
        title,
        clientName,
        client_brand_hex,
        at: shoot,
        status,
        public_status,
        shooting_date: shoot,
        client_delivery_at: row.client_delivery_at as string | null,
        delivery_deadline: row.delivery_deadline as string | null,
      });
    }
    if (showDelivery && deliveryIso && inRange(deliveryIso, startMs, endMs)) {
      out.push({
        id: `vdel-${id}`,
        videoId: id,
        kind: 'delivery',
        title,
        clientName,
        client_brand_hex,
        at: deliveryIso,
        status,
        public_status,
        shooting_date: shoot,
        client_delivery_at: row.client_delivery_at as string | null,
        delivery_deadline: row.delivery_deadline as string | null,
      });
    }
  }

  out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return out;
}
