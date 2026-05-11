import { createClient } from '@/lib/supabase/server';
import type { TaskPriority, TaskStatus, UserRole, VideoStatus } from '@/types/database';
import { effectiveClientDeliveryIso } from '@/lib/videos/video-schedule';
import {
  fetchMyVideoRoleFlagsForVideos,
  fetchVideoIdsAssignedToEmployee,
  fetchVideoIdsForAssignmentRole,
} from '@/lib/data/video-assignments';
import { fetchTaskIdsAssignedToEmployee } from '@/lib/data/task-assignments';

export interface PersonalTaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  clientName: string | null;
  projectTitle: string | null;
}

export interface PersonalVideoRow {
  id: string;
  title: string;
  status: VideoStatus;
  delivery_deadline: string | null;
  client_delivery_at: string | null;
  shooting_date: string | null;
  clientName: string | null;
  /** Montage seul, tournage seul, ou les deux (assignations multiples / legacy). */
  role: 'editor' | 'cameraman' | 'both';
}

function scopeKey(role: UserRole): UserRole {
  return role === 'designer' ? 'developer' : role;
}

export async function getPersonalDashboardWork(
  employeeId: string,
  role: UserRole
): Promise<{ tasks: PersonalTaskRow[]; videos: PersonalVideoRow[] }> {
  const supabase = await createClient();
  const rk = scopeKey(role);

  const fromTaskPivot = await fetchTaskIdsAssignedToEmployee(supabase, employeeId);
  const taskOrParts = [`assignee_id.eq.${employeeId}`];
  if (fromTaskPivot.length) taskOrParts.push(`id.in.(${fromTaskPivot.join(',')})`);

  const { data: taskRows, error: tErr } = await supabase
    .from('tasks')
    .select(
      `
      id,
      title,
      status,
      priority,
      deadline,
      clients:client_id ( name ),
      projects:project_id ( title )
    `
    )
    .or(taskOrParts.join(','))
    .neq('status', 'done')
    .neq('status', 'archived')
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(14);

  if (tErr) throw new Error(tErr.message);

  const tasks: PersonalTaskRow[] = (taskRows ?? []).map((row: Record<string, unknown>) => {
    const clients = row.clients as { name?: string } | null;
    const projects = row.projects as { title?: string } | null;
    return {
      id: String(row.id),
      title: String(row.title),
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      deadline: row.deadline ? String(row.deadline) : null,
      clientName: clients?.name ?? null,
      projectTitle: projects?.title ?? null,
    };
  });

  let videos: PersonalVideoRow[] = [];

  if (rk === 'editor' || rk === 'cameraman' || rk === 'community_manager') {
    let vidQ = supabase
      .from('videos')
      .select(
        `
        id,
        title,
        status,
        delivery_deadline,
        client_delivery_at,
        shooting_date,
        editor_id,
        cameraman_id,
        clients:client_id ( name )
      `
      )
      .not('status', 'eq', 'published')
      .not('status', 'eq', 'archived')
      .not('status', 'eq', 'cancelled')
      .order('delivery_deadline', { ascending: true, nullsFirst: false })
      .limit(20);

    if (rk === 'editor') {
      const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, employeeId);
      const parts = [`editor_id.eq.${employeeId}`, `cameraman_id.eq.${employeeId}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      vidQ = vidQ.or(parts.join(','));
    } else if (rk === 'cameraman') {
      const fromVa = await fetchVideoIdsForAssignmentRole(supabase, employeeId, 'cameraman');
      const parts = [`cameraman_id.eq.${employeeId}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      vidQ = vidQ.or(parts.join(','));
    } else {
      const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, employeeId);
      const parts = [`editor_id.eq.${employeeId}`, `cameraman_id.eq.${employeeId}`];
      if (fromVa.length) parts.push(`id.in.(${fromVa.join(',')})`);
      vidQ = vidQ.or(parts.join(','));
    }

    const { data: vidRows, error: vErr } = await vidQ;
    if (vErr) throw new Error(vErr.message);

    const rawRows = (vidRows ?? []) as Record<string, unknown>[];
    const roleMap = await fetchMyVideoRoleFlagsForVideos(
      supabase,
      employeeId,
      rawRows.map((row) => ({
        id: String(row.id),
        editor_id: row.editor_id as string | null | undefined,
        cameraman_id: row.cameraman_id as string | null | undefined,
      })),
    );

    const seenVid = new Set<string>();
    videos = rawRows
      .filter((row) => {
        const id = String(row.id);
        if (seenVid.has(id)) return false;
        seenVid.add(id);
        return true;
      })
      .map((row) => {
        const clients = row.clients as { name?: string } | null;
        const id = String(row.id);
        const flags = roleMap.get(id) ?? { hasEditor: false, hasCameraman: false };
        const vRole: 'editor' | 'cameraman' | 'both' =
          flags.hasEditor && flags.hasCameraman
            ? 'both'
            : flags.hasCameraman
              ? 'cameraman'
              : 'editor';
        return {
          id,
          title: String(row.title),
          status: row.status as VideoStatus,
          delivery_deadline: row.delivery_deadline ? String(row.delivery_deadline) : null,
          client_delivery_at: row.client_delivery_at ? String(row.client_delivery_at) : null,
          shooting_date: row.shooting_date ? String(row.shooting_date) : null,
          clientName: clients?.name ?? null,
          role: vRole,
        };
      });
    videos.sort((a, b) => {
      const ta = effectiveClientDeliveryIso(a);
      const tb = effectiveClientDeliveryIso(b);
      const da = ta ? new Date(ta).getTime() : Infinity;
      const db = tb ? new Date(tb).getTime() : Infinity;
      return da - db;
    });
  }

  return { tasks, videos };
}
