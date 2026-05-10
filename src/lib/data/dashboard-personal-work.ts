import { createClient } from '@/lib/supabase/server';
import type { TaskPriority, TaskStatus, UserRole, VideoStatus } from '@/types/database';

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
  shooting_date: string | null;
  clientName: string | null;
  role: 'editor' | 'cameraman';
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
    .eq('assignee_id', employeeId)
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
      vidQ = vidQ.eq('editor_id', employeeId);
    } else if (rk === 'cameraman') {
      vidQ = vidQ.eq('cameraman_id', employeeId);
    } else {
      vidQ = vidQ.or(`editor_id.eq.${employeeId},cameraman_id.eq.${employeeId}`);
    }

    const { data: vidRows, error: vErr } = await vidQ;
    if (vErr) throw new Error(vErr.message);

    videos = (vidRows ?? []).map((row: Record<string, unknown>) => {
      const clients = row.clients as { name?: string } | null;
      const ed = row.editor_id as string | null;
      const cam = row.cameraman_id as string | null;
      const asEditor = ed === employeeId;
      const asCam = cam === employeeId;
      const vRole: 'editor' | 'cameraman' =
        rk === 'cameraman' || (asCam && !asEditor) ? 'cameraman' : 'editor';
      return {
        id: String(row.id),
        title: String(row.title),
        status: row.status as VideoStatus,
        delivery_deadline: row.delivery_deadline ? String(row.delivery_deadline) : null,
        shooting_date: row.shooting_date ? String(row.shooting_date) : null,
        clientName: clients?.name ?? null,
        role: vRole,
      };
    });
  }

  return { tasks, videos };
}
