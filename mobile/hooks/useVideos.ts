/**
 * Video data access — direct Supabase queries, RLS-scoped
 * (videos_select_scoped → auth_staff_video_visible in supabase/policies.sql).
 * Minimal columns, 50 rows max, archived/cancelled excluded.
 *
 * Filter chips group statuses the same way as the web kanban
 * (src/types/domain.ts VIDEO_KANBAN_COLUMNS), split to match the mobile chips.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logDevError, toUserMessage } from '@/lib/errors';
import { effectiveClientDeliveryIso } from '@/lib/video-meta';
import type { VideoFormat, VideoPublicStatus, VideoStatus } from '@/types/db';
import type { TaskAssigneeInfo } from '@/hooks/useTasks';

export type VideoAssignmentRole = 'editor' | 'cameraman';

export interface VideoTeamMember extends TaskAssigneeInfo {
  assignment_role: VideoAssignmentRole | null;
}

export interface VideoListItem {
  id: string;
  title: string;
  status: VideoStatus;
  public_status: VideoPublicStatus | null;
  format: VideoFormat | null;
  shooting_date: string | null;
  client_delivery_at: string | null;
  delivery_deadline: string | null;
  client_id: string | null;
  client_name: string | null;
  team: VideoTeamMember[];
}

export interface VideoLinkedTask {
  id: string;
  title: string;
  status: string;
}

export interface VideoDetail extends VideoListItem {
  topic: string | null;
  brief: string | null;
  created_at: string;
  updated_at: string;
  linkedTasks: VideoLinkedTask[];
}

export type VideoFilter =
  | 'all'
  | 'preparation'
  | 'shooting'
  | 'editing'
  | 'review'
  | 'waiting_client'
  | 'delivered';

export const VIDEO_FILTERS: { key: VideoFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'preparation', label: 'Préparation' },
  { key: 'shooting', label: 'Tournage' },
  { key: 'editing', label: 'Montage' },
  { key: 'review', label: 'En révision' },
  { key: 'waiting_client', label: 'Attente client' },
  { key: 'delivered', label: 'Livré' },
];

/** Status groups per chip — aligned with the web kanban columns. */
const FILTER_STATUSES: Record<Exclude<VideoFilter, 'all'>, VideoStatus[]> = {
  preparation: ['idea', 'brief_pending', 'brief_validated'],
  shooting: ['shooting_planned', 'shooting_in_progress', 'shooting_done', 'rushes_received'],
  editing: ['editing'],
  review: ['internal_review', 'client_revision'],
  waiting_client: ['sent_to_client'],
  delivered: ['validated', 'published'],
};

const EXCLUDED = '("archived","cancelled")';

const LIST_COLUMNS =
  'id, title, status, public_status, format, shooting_date, client_delivery_at, delivery_deadline, client_id, ' +
  'clients(name), ' +
  'video_assignments(assignment_role, employees(id, full_name, avatar_initials, avatar_color)), ' +
  'editor:employees!editor_id(id, full_name, avatar_initials, avatar_color), ' +
  'cameraman:employees!cameraman_id(id, full_name, avatar_initials, avatar_color)';

const DETAIL_COLUMNS =
  'id, title, topic, brief, status, public_status, format, shooting_date, client_delivery_at, delivery_deadline, client_id, created_at, updated_at, ' +
  'clients(name), ' +
  'video_assignments(assignment_role, employees(id, full_name, avatar_initials, avatar_color)), ' +
  'editor:employees!editor_id(id, full_name, avatar_initials, avatar_color), ' +
  'cameraman:employees!cameraman_id(id, full_name, avatar_initials, avatar_color)';

interface RawEmployee {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  avatar_color: string | null;
}

interface RawVideoRow {
  id: string;
  title: string;
  topic?: string | null;
  brief?: string | null;
  status: VideoStatus;
  public_status: VideoPublicStatus | null;
  format: VideoFormat | null;
  shooting_date: string | null;
  client_delivery_at: string | null;
  delivery_deadline: string | null;
  client_id: string | null;
  created_at?: string;
  updated_at?: string;
  clients: { name: string } | null;
  video_assignments:
    | { assignment_role: VideoAssignmentRole | null; employees: RawEmployee | null }[]
    | null;
  editor: RawEmployee | null;
  cameraman: RawEmployee | null;
}

/** Pivot video_assignments first; legacy editor_id / cameraman_id as fallback. */
function resolveTeam(row: RawVideoRow): VideoTeamMember[] {
  const out: VideoTeamMember[] = [];
  const seen = new Set<string>();
  for (const a of row.video_assignments ?? []) {
    if (a.employees && !seen.has(a.employees.id)) {
      seen.add(a.employees.id);
      out.push({ ...a.employees, assignment_role: a.assignment_role });
    }
  }
  if (row.editor && !seen.has(row.editor.id)) {
    seen.add(row.editor.id);
    out.push({ ...row.editor, assignment_role: 'editor' });
  }
  if (row.cameraman && !seen.has(row.cameraman.id)) {
    seen.add(row.cameraman.id);
    out.push({ ...row.cameraman, assignment_role: 'cameraman' });
  }
  return out;
}

function toListItem(row: RawVideoRow): VideoListItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    public_status: row.public_status,
    format: row.format,
    shooting_date: row.shooting_date,
    client_delivery_at: row.client_delivery_at,
    delivery_deadline: row.delivery_deadline,
    client_id: row.client_id,
    client_name: row.clients?.name ?? null,
    team: resolveTeam(row),
  };
}

async function fetchVideos(filter: VideoFilter): Promise<VideoListItem[]> {
  let query = supabase.from('videos').select(LIST_COLUMNS);
  if (filter === 'all') {
    query = query.filter('status', 'not.in', EXCLUDED);
  } else {
    const statuses = FILTER_STATUSES[filter];
    query = query.filter('status', 'in', `(${statuses.map((s) => `"${s}"`).join(',')})`);
  }
  const { data, error } = await query
    .order('client_delivery_at', { ascending: true, nullsFirst: false })
    .order('shooting_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const items = ((data ?? []) as unknown as RawVideoRow[]).map(toListItem);
  // Web sorts by effective delivery date (legacy fallback included) — mirror it.
  items.sort((a, b) => {
    const da = effectiveClientDeliveryIso(a);
    const db = effectiveClientDeliveryIso(b);
    const ta = da ? new Date(da).getTime() : Infinity;
    const tb = db ? new Date(db).getTime() : Infinity;
    return ta - tb;
  });
  return items;
}

export function useVideos(filter: VideoFilter) {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setVideos(await fetchVideos(filter));
    } catch (e) {
      logDevError('useVideos', e);
      setError(toUserMessage(e));
    }
  }, [filter]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    load().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { videos, loading, refreshing, error, refresh };
}

export function useVideoDetail(videoId: string | null) {
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!videoId) return;
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('videos')
        .select(DETAIL_COLUMNS)
        .eq('id', videoId)
        .maybeSingle();
      if (err) throw new Error(err.message);
      if (!data) {
        setVideo(null);
        setError('Vidéo introuvable ou inaccessible.');
        return;
      }
      const row = data as unknown as RawVideoRow;

      // Linked production tasks (RLS-scoped; missing rows just don't show).
      let linkedTasks: VideoLinkedTask[] = [];
      try {
        const { data: taskRows } = await supabase
          .from('tasks')
          .select('id, title, status')
          .eq('video_id', videoId)
          .neq('status', 'archived')
          .limit(5);
        linkedTasks = (taskRows ?? []) as VideoLinkedTask[];
      } catch {
        // non-blocking
      }

      setVideo({
        ...toListItem(row),
        topic: row.topic ?? null,
        brief: row.brief ?? null,
        created_at: row.created_at ?? '',
        updated_at: row.updated_at ?? '',
        linkedTasks,
      });
    } catch (e) {
      logDevError('useVideoDetail', e);
      setError(toUserMessage(e));
    }
  }, [videoId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    load().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [load]);

  return { video, loading, error, reload: load };
}
