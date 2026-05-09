import { createClient } from '@/lib/supabase/server';
import type { Employee, Task, TaskStatus, UserRole, Video } from '@/types/database';

const OPEN_TASK_STATUSES: TaskStatus[] = [
  'todo',
  'in_progress',
  'waiting_client',
  'waiting_team',
  'review',
  'blocked',
];

export type TeamMemberRow = Employee & {
  open_tasks: number;
  overdue_tasks: number;
  workload_percent: number;
  availability: 'available' | 'busy' | 'overloaded' | 'inactive';
  videos_assigned: number;
  client_projects_led: number;
  internal_projects_owned: number;
};

function deriveAvailability(
  isActive: boolean,
  open: number,
  overdue: number,
): TeamMemberRow['availability'] {
  if (!isActive) return 'inactive';
  if (overdue >= 3 || open > 12) return 'overloaded';
  if (open > 6 || overdue >= 1) return 'busy';
  return 'available';
}

function workloadPercent(open: number, weeklyCapacity: number): number {
  const cap = Math.max(weeklyCapacity || 35, 1);
  const ratio = (open / cap) * 100;
  return Math.min(100, Math.round(ratio * 10) / 10);
}

export interface TeamListFilters {
  search?: string;
  role?: UserRole | 'all';
  availability?: TeamMemberRow['availability'] | 'all';
  /** Compte employé : actif / inactif (is_active), distinct de la charge */
  account?: 'all' | 'active' | 'inactive';
  /** Par défaut on exclut les archivés ; `include` = tous ; `only` = archivés seulement */
  archived?: 'exclude' | 'include' | 'only';
  /** Filtrer les membres avec au moins une tâche en retard */
  overdueOnly?: boolean;
  /** Compétence opérationnelle (rôle principal OU operational_skills) */
  skill?: UserRole | 'all';
}

async function enrichEmployeesToRows(emps: Employee[]): Promise<TeamMemberRow[]> {
  if (emps.length === 0) return [];

  const supabase = await createClient();
  const empIds = emps.map((e) => e.id);
  const nowIso = new Date().toISOString();

  const [tasksRes, vEd, vCam, projRes, intRes] = await Promise.all([
    supabase.from('tasks').select('id, assignee_id, status, deadline').in('assignee_id', empIds),
    supabase.from('videos').select('id, editor_id, cameraman_id').in('editor_id', empIds),
    supabase.from('videos').select('id, editor_id, cameraman_id').in('cameraman_id', empIds),
    supabase.from('projects').select('id, lead_id').in('lead_id', empIds).neq('status', 'archived'),
    supabase.from('internal_projects').select('id, owner_id').in('owner_id', empIds).neq('status', 'archived'),
  ]);
  const videoRows = [...(vEd.data ?? []), ...(vCam.data ?? [])];
  const seenVid = new Set<string>();
  const videosResData = videoRows.filter((v) => {
    const id = (v as { id: string }).id;
    if (seenVid.has(id)) return false;
    seenVid.add(id);
    return true;
  });

  const tasks = (tasksRes.data ?? []) as Pick<Task, 'id' | 'assignee_id' | 'status' | 'deadline'>[];
  const openByEmp = new Map<string, number>();
  const overdueByEmp = new Map<string, number>();

  for (const t of tasks) {
    if (!t.assignee_id) continue;
    if (!OPEN_TASK_STATUSES.includes(t.status)) continue;
    openByEmp.set(t.assignee_id, (openByEmp.get(t.assignee_id) ?? 0) + 1);
    if (t.deadline && t.deadline < nowIso) {
      overdueByEmp.set(t.assignee_id, (overdueByEmp.get(t.assignee_id) ?? 0) + 1);
    }
  }

  const videoCount = new Map<string, number>();
  for (const v of videosResData) {
    const row = v as Pick<Video, 'editor_id' | 'cameraman_id'>;
    if (row.editor_id) videoCount.set(row.editor_id, (videoCount.get(row.editor_id) ?? 0) + 1);
    if (row.cameraman_id && row.cameraman_id !== row.editor_id) {
      videoCount.set(row.cameraman_id, (videoCount.get(row.cameraman_id) ?? 0) + 1);
    }
  }

  const ledCount = new Map<string, number>();
  for (const p of projRes.data ?? []) {
    const lead = (p as { lead_id: string }).lead_id;
    ledCount.set(lead, (ledCount.get(lead) ?? 0) + 1);
  }

  const ownedCount = new Map<string, number>();
  for (const p of intRes.data ?? []) {
    const oid = (p as { owner_id: string }).owner_id;
    ownedCount.set(oid, (ownedCount.get(oid) ?? 0) + 1);
  }

  return emps.map((e) => {
    const open = openByEmp.get(e.id) ?? 0;
    const overdue = overdueByEmp.get(e.id) ?? 0;
    return {
      ...e,
      open_tasks: open,
      overdue_tasks: overdue,
      workload_percent: workloadPercent(open, e.weekly_capacity),
      availability: deriveAvailability(e.is_active, open, overdue),
      videos_assigned: videoCount.get(e.id) ?? 0,
      client_projects_led: ledCount.get(e.id) ?? 0,
      internal_projects_owned: ownedCount.get(e.id) ?? 0,
    };
  });
}

export async function listTeamMembersWithStats(filters: TeamListFilters = {}): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  let q = supabase.from('employees').select('*').order('full_name');

  const archivedMode = filters.archived ?? 'exclude';
  if (archivedMode === 'only') {
    q = q.not('archived_at', 'is', null);
  } else if (archivedMode === 'exclude') {
    q = q.is('archived_at', null);
  }

  const account = filters.account ?? 'all';
  if (account === 'active') q = q.eq('is_active', true);
  if (account === 'inactive') q = q.eq('is_active', false);

  const { data: employees, error } = await q;
  if (error) throw new Error(error.message);
  const emps = (employees ?? []) as Employee[];
  if (emps.length === 0) return [];

  let rows = await enrichEmployeesToRows(emps);

  const s = filters.search?.trim().toLowerCase();
  if (s) {
    rows = rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s) ||
        (r.phone?.toLowerCase().includes(s) ?? false),
    );
  }
  if (filters.role && filters.role !== 'all') {
    rows = rows.filter((r) => r.role === filters.role);
  }
  if (filters.skill && filters.skill !== 'all') {
    const sk = filters.skill;
    rows = rows.filter(
      (r) => r.role === sk || (r.operational_skills ?? []).includes(sk),
    );
  }
  if (filters.availability && filters.availability !== 'all') {
    rows = rows.filter((r) => r.availability === filters.availability);
  }
  if (filters.overdueOnly) {
    rows = rows.filter((r) => r.overdue_tasks > 0);
  }

  return rows;
}

export type TeamMemberDetail = TeamMemberRow & {
  recentTasks: Task[];
  videosAsEditor: Video[];
  videosAsCameraman: Video[];
};

export async function getTeamMemberDetail(employeeId: string): Promise<TeamMemberDetail | null> {
  const supabase = await createClient();
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .maybeSingle();
  if (empErr || !emp) return null;

  const [rowArr] = await enrichEmployeesToRows([emp as Employee]);
  if (!rowArr) return null;

  const [tasksRes, videosRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('assignee_id', employeeId)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(25),
    supabase
      .from('videos')
      .select('*')
      .or(`editor_id.eq.${employeeId},cameraman_id.eq.${employeeId}`)
      .order('updated_at', { ascending: false })
      .limit(40),
  ]);

  const allVids = (videosRes.data ?? []) as Video[];
  const videosAsEditor = allVids.filter((v) => v.editor_id === employeeId).slice(0, 15);
  const videosAsCameraman = allVids.filter((v) => v.cameraman_id === employeeId).slice(0, 15);

  return {
    ...rowArr,
    recentTasks: (tasksRes.data ?? []) as Task[],
    videosAsEditor,
    videosAsCameraman,
  };
}
