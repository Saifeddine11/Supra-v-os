import { createClient } from '@/lib/supabase/server';
import type {
  InternalPriority,
  InternalProject,
  ProjectStatus,
  Task,
} from '@/types/database';

export type InternalProjectListRow = InternalProject & {
  owner_name: string | null;
  task_count: number;
};

export interface InternalProjectListFilters {
  search?: string;
  status?: ProjectStatus | 'all';
  ownerId?: string | 'all';
  priority?: InternalPriority | 'all';
}

export async function listInternalProjectsWithStats(
  filters: InternalProjectListFilters = {}
): Promise<InternalProjectListRow[]> {
  const supabase = await createClient();
  let q = supabase.from('internal_projects').select('*').order('updated_at', { ascending: false });

  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters.ownerId && filters.ownerId !== 'all') q = q.eq('owner_id', filters.ownerId);
  if (filters.priority && filters.priority !== 'all') q = q.eq('priority', filters.priority);

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  const projects = (rows ?? []) as InternalProject[];
  if (projects.length === 0) return [];

  const ids = projects.map((p) => p.id);
  const ownerIds = [...new Set(projects.map((p) => p.owner_id).filter(Boolean))] as string[];

  const [ownersRes, taskRes] = await Promise.all([
    ownerIds.length ? supabase.from('employees').select('id, full_name').in('id', ownerIds) : Promise.resolve({ data: [] }),
    supabase.from('tasks').select('id, internal_project_id').in('internal_project_id', ids),
  ]);

  const ownerMap = new Map((ownersRes.data ?? []).map((e: { id: string; full_name: string }) => [e.id, e.full_name]));
  const taskCount = new Map<string, number>();
  for (const t of taskRes.data ?? []) {
    const iid = (t as { internal_project_id: string | null }).internal_project_id;
    if (!iid) continue;
    taskCount.set(iid, (taskCount.get(iid) ?? 0) + 1);
  }

  let result: InternalProjectListRow[] = projects.map((p) => ({
    ...p,
    owner_name: p.owner_id ? (ownerMap.get(p.owner_id) ?? null) : null,
    task_count: taskCount.get(p.id) ?? 0,
  }));

  const s = filters.search?.trim().toLowerCase();
  if (s) {
    result = result.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        (p.description?.toLowerCase().includes(s) ?? false) ||
        (p.category?.toLowerCase().includes(s) ?? false)
    );
  }

  return result;
}

export type InternalProjectDetail = {
  project: InternalProject & { owner_name: string | null };
  tasks: Task[];
};

export async function getInternalProjectDetail(id: string): Promise<InternalProjectDetail | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase.from('internal_projects').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;
  const project = row as InternalProject;
  let owner_name: string | null = null;
  if (project.owner_id) {
    const { data: o } = await supabase.from('employees').select('full_name').eq('id', project.owner_id).maybeSingle();
    owner_name = o?.full_name ?? null;
  }
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('internal_project_id', id)
    .order('deadline', { ascending: true, nullsFirst: false });
  return {
    project: { ...project, owner_name },
    tasks: (tasks ?? []) as Task[],
  };
}
