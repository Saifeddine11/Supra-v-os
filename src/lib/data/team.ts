import { createClient } from '@/lib/supabase/server';
import type { Employee, Task, TaskStatus, UserRole, Video } from '@/types/database';
import { fetchVideoIdsAssignedToEmployee } from '@/lib/data/video-assignments';
import { fetchTaskIdsAssignedToEmployee } from '@/lib/data/task-assignments';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import { canViewTeamDirectory, isDepartmentSupervisor } from '@/lib/auth/supervision';

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

  const empIdSet = new Set(empIds);
  const [tasksLegRes, taRes, vaRes, vEd, vCam, projRes, intRes] = await Promise.all([
    supabase.from('tasks').select('id, assignee_id, status, deadline').in('assignee_id', empIds),
    supabase.from('task_assignments').select('task_id, employee_id').in('employee_id', empIds),
    supabase.from('video_assignments').select('video_id, employee_id').in('employee_id', empIds),
    supabase.from('videos').select('id, editor_id, cameraman_id').in('editor_id', empIds),
    supabase.from('videos').select('id, editor_id, cameraman_id').in('cameraman_id', empIds),
    supabase.from('projects').select('id, lead_id').in('lead_id', empIds).neq('status', 'archived'),
    supabase.from('internal_projects').select('id, owner_id').in('owner_id', empIds).neq('status', 'archived'),
  ]);

  const taskToEmps = new Map<string, Set<string>>();
  const addTaskEmp = (taskId: string, eid: string) => {
    if (!empIdSet.has(eid)) return;
    if (!taskToEmps.has(taskId)) taskToEmps.set(taskId, new Set());
    taskToEmps.get(taskId)!.add(eid);
  };
  for (const r of taRes.data ?? []) {
    addTaskEmp(r.task_id as string, r.employee_id as string);
  }
  for (const t of tasksLegRes.data ?? []) {
    const tid = t.id as string;
    const aid = t.assignee_id as string | null;
    if (aid) addTaskEmp(tid, aid);
  }

  const allTaskIds = [...taskToEmps.keys()];
  const { data: taskFullRows } =
    allTaskIds.length > 0
      ? await supabase.from('tasks').select('id, status, deadline').in('id', allTaskIds)
      : { data: [] as { id: string; status: TaskStatus; deadline: string | null }[] };

  const openByEmp = new Map<string, number>();
  const overdueByEmp = new Map<string, number>();
  for (const eid of empIds) {
    openByEmp.set(eid, 0);
    overdueByEmp.set(eid, 0);
  }
  for (const t of taskFullRows ?? []) {
    if (!OPEN_TASK_STATUSES.includes(t.status)) continue;
    const emps = taskToEmps.get(t.id);
    if (!emps) continue;
    for (const eid of emps) {
      openByEmp.set(eid, (openByEmp.get(eid) ?? 0) + 1);
      if (t.deadline && t.deadline < nowIso) {
        overdueByEmp.set(eid, (overdueByEmp.get(eid) ?? 0) + 1);
      }
    }
  }

  const videosByEmp = new Map<string, Set<string>>();
  for (const eid of empIds) videosByEmp.set(eid, new Set());
  for (const r of vaRes.data ?? []) {
    const eid = r.employee_id as string;
    const vid = r.video_id as string;
    if (empIdSet.has(eid)) videosByEmp.get(eid)?.add(vid);
  }
  for (const v of [...(vEd.data ?? []), ...(vCam.data ?? [])]) {
    const row = v as Pick<Video, 'id' | 'editor_id' | 'cameraman_id'>;
    if (row.editor_id && empIdSet.has(row.editor_id)) videosByEmp.get(row.editor_id)?.add(row.id);
    if (row.cameraman_id && empIdSet.has(row.cameraman_id)) videosByEmp.get(row.cameraman_id)?.add(row.id);
  }
  const videoCount = new Map<string, number>();
  for (const eid of empIds) {
    videoCount.set(eid, videosByEmp.get(eid)?.size ?? 0);
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

export async function listTeamMembersWithStats(
  filters: TeamListFilters = {},
  ctx: AuthContext | null = null,
): Promise<TeamMemberRow[]> {
  const auth = ctx ?? (await getAuthContext());
  if (!auth?.role || !canViewTeamDirectory(auth.role, auth.employee?.is_department_supervisor)) return [];

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

  if (isDepartmentSupervisor(auth.employee ?? auth.role)) {
    const dept = auth.employee?.department ?? null;
    if (!dept) return [];
    rows = rows.filter((r) => r.department === dept);
  }

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

  const fromVa = await fetchVideoIdsAssignedToEmployee(supabase, employeeId);
  const videoOrParts = [`editor_id.eq.${employeeId}`, `cameraman_id.eq.${employeeId}`];
  if (fromVa.length) videoOrParts.push(`id.in.(${fromVa.join(',')})`);

  const fromTasksPivot = await fetchTaskIdsAssignedToEmployee(supabase, employeeId);
  const taskOrParts = [`assignee_id.eq.${employeeId}`];
  if (fromTasksPivot.length) taskOrParts.push(`id.in.(${fromTasksPivot.join(',')})`);

  const [tasksRes, videosRes, rolesRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .or(taskOrParts.join(','))
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(25),
    supabase
      .from('videos')
      .select('*')
      .or(videoOrParts.join(','))
      .order('updated_at', { ascending: false })
      .limit(40),
    supabase
      .from('video_assignments')
      .select('video_id, assignment_role')
      .eq('employee_id', employeeId),
  ]);

  const asEditorVa = new Set(
    (rolesRes.data ?? []).filter((r) => r.assignment_role === 'editor').map((r) => r.video_id as string),
  );
  const asCamVa = new Set(
    (rolesRes.data ?? []).filter((r) => r.assignment_role === 'cameraman').map((r) => r.video_id as string),
  );

  const allVids = (videosRes.data ?? []) as Video[];
  const videosAsEditor = allVids
    .filter((v) => v.editor_id === employeeId || asEditorVa.has(v.id))
    .slice(0, 15);
  const videosAsCameraman = allVids
    .filter((v) => v.cameraman_id === employeeId || asCamVa.has(v.id))
    .slice(0, 15);

  return {
    ...rowArr,
    recentTasks: (tasksRes.data ?? []) as Task[],
    videosAsEditor,
    videosAsCameraman,
  };
}
