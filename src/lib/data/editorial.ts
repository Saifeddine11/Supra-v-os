import { createClient } from '@/lib/supabase/server';
import type { EditorialCalendar, Video, VideoPlatform, VideoStatus } from '@/types/database';

const DELIVERED: VideoStatus[] = ['validated', 'published'];
const CANCELLED: VideoStatus[] = ['cancelled', 'archived'];

export type EditorialCalendarRow = EditorialCalendar & {
  clients: { id: string; name: string; monthly_video_quota: number } | null;
  delivered: number;
  in_progress: number;
  remaining: number;
  quota_gap: boolean;
  videos: Pick<Video, 'id' | 'title' | 'status' | 'platform' | 'delivery_deadline' | 'publication_date'>[];
};

function monthStartIso(year: number, month1: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month1)}-01`;
}

export interface EditorialFilters {
  year: number;
  month: number; // 1-12
  clientId?: string | 'all';
  platform?: VideoPlatform | 'all';
  status?: VideoStatus | 'all';
}

export async function listEditorialCalendarsForMonth(filters: EditorialFilters): Promise<EditorialCalendarRow[]> {
  const supabase = await createClient();
  const monthIso = monthStartIso(filters.year, filters.month);

  let q = supabase
    .from('editorial_calendars')
    .select('*, clients(id, name, monthly_video_quota)')
    .eq('month', monthIso);

  if (filters.clientId && filters.clientId !== 'all') {
    q = q.eq('client_id', filters.clientId);
  }

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  type Raw = EditorialCalendar & {
    clients: { id: string; name: string; monthly_video_quota: number } | { id: string; name: string; monthly_video_quota: number }[] | null;
  };
  const calendars = (rows ?? []) as Raw[];
  if (calendars.length === 0) return [];

  const calIds = calendars.map((c) => c.id);
  let vq = supabase
    .from('videos')
    .select('id, title, status, platform, delivery_deadline, publication_date, editorial_calendar_id, client_id')
    .in('editorial_calendar_id', calIds);

  if (filters.platform && filters.platform !== 'all') vq = vq.eq('platform', filters.platform);
  if (filters.status && filters.status !== 'all') vq = vq.eq('status', filters.status);

  const { data: vids, error: e2 } = await vq;
  if (e2) throw new Error(e2.message);
  const videosByCal = new Map<string, typeof vids>();
  for (const v of vids ?? []) {
    const row = v as { editorial_calendar_id: string | null };
    if (!row.editorial_calendar_id) continue;
    const list = videosByCal.get(row.editorial_calendar_id) ?? [];
    list.push(v);
    videosByCal.set(row.editorial_calendar_id, list);
  }

  return calendars.map((c) => {
    const clients = Array.isArray(c.clients) ? c.clients[0] ?? null : c.clients;
    const vlist = (videosByCal.get(c.id) ?? []) as Array<
      Pick<Video, 'id' | 'title' | 'status' | 'platform' | 'delivery_deadline' | 'publication_date'>
    >;
    const delivered = vlist.filter((v) => DELIVERED.includes(v.status)).length;
    const in_progress = vlist.filter((v) => !DELIVERED.includes(v.status) && !CANCELLED.includes(v.status)).length;
    const remaining = Math.max(0, c.quota - delivered);
    const quota_gap = c.quota > 0 && delivered < c.quota;
    return {
      ...c,
      clients,
      delivered,
      in_progress,
      remaining,
      quota_gap,
      videos: vlist,
    };
  });
}

/** Vidéos du mois sans ligne de calendrier (pour rattachement ou pilotage). */
export async function listOrphanVideosForMonth(year: number, month: number) {
  const supabase = await createClient();
  const pad = (n: number) => String(n).padStart(2, '0');
  const startS = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endS = `${year}-${pad(month)}-${pad(lastDay)}`;

  const { data, error } = await supabase
    .from('videos')
    .select('id, client_id, title, status, platform, delivery_deadline, editorial_calendar_id, clients(name)')
    .is('editorial_calendar_id', null)
    .gte('delivery_deadline', startS)
    .lte('delivery_deadline', endS)
    .order('delivery_deadline');

  if (error) throw new Error(error.message);
  type Raw = {
    id: string;
    title: string;
    clients: { name: string } | { name: string }[] | null;
  };
  return (data ?? []).map((row) => {
    const r = row as Raw;
    const c = Array.isArray(r.clients) ? r.clients[0] ?? null : r.clients;
    return { id: r.id, title: r.title, clientName: c?.name ?? null };
  });
}
