import 'server-only';

import { endOfDay, format, isWithinInterval, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { isDepartmentSupervisor } from '@/lib/auth/supervision';
import { fetchAssignmentsForTasks, formatTaskAssigneeSummary } from '@/lib/data/task-assignments';
import { departmentLabel } from '@/lib/auth/supervision';
import { ROLE_LABELS, TASK_STATUS_MAP } from '@/types/domain';
import type { TaskDepartment, TaskPriority, TaskStatus } from '@/types/database';
import { getClientColor } from '@/lib/ui/client-colors';

const OPEN_STATUSES: TaskStatus[] = [
  'todo',
  'in_progress',
  'waiting_client',
  'waiting_team',
  'review',
  'blocked',
];

export type SupervisorTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  overdue: boolean;
  assignee: string;
  clientName: string | null;
  clientBrandHex: string | null;
};

export type SupervisorMemberRow = {
  id: string;
  name: string;
  roleLabel: string;
  activeTaskCount: number;
  overdueTaskCount: number;
  currentTasks: { id: string; title: string; status: TaskStatus }[];
};

export type SupervisorDashboardData = {
  department: TaskDepartment;
  departmentLabel: string;
  members: SupervisorMemberRow[];
  today: SupervisorTaskRow[];
  upcoming: SupervisorTaskRow[];
  overdue: SupervisorTaskRow[];
  blocked: SupervisorTaskRow[];
  completed: SupervisorTaskRow[];
};

function taskDueLabel(deadline: string | null, overdue: boolean): string {
  if (!deadline) return 'Sans date';
  const d = new Date(deadline);
  if (overdue) return format(d, "d MMM yyyy · HH:mm", { locale: fr });
  return format(d, "d MMM yyyy · HH:mm", { locale: fr });
}

export async function fetchSupervisorDashboard(ctx: AuthContext): Promise<SupervisorDashboardData | null> {
  if (!isDepartmentSupervisor(ctx.employee ?? ctx.role) || !ctx.employee?.department) return null;

  const department = ctx.employee.department;
  const supabase = await createClient();
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const nowIso = now.toISOString();

  const [empR, taskR] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, role, department')
      .eq('department', department)
      .eq('is_active', true)
      .is('archived_at', null)
      .order('full_name'),
    supabase
      .from('tasks')
      .select('id, title, status, priority, deadline, assignee_id, client_id, clients(name, color_hex)')
      .eq('department', department)
      .neq('status', 'archived')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(400),
  ]);

  const employees = empR.data ?? [];
  const tasks = taskR.data ?? [];
  const assignMap = await fetchAssignmentsForTasks(
    supabase,
    tasks.map((t) => t.id as string),
  );
  const empName = new Map(employees.map((e) => [e.id as string, e.full_name as string]));

  function toRow(t: (typeof tasks)[number]): SupervisorTaskRow {
    const people = assignMap.get(t.id as string) ?? [];
    const assignee =
      people.length > 0
        ? formatTaskAssigneeSummary(people)
        : t.assignee_id
          ? (empName.get(t.assignee_id as string) ?? 'Non assigné')
          : 'Non assigné';
    const cl = t.clients as { name?: string; color_hex?: string | null } | null;
    const clientName = cl?.name ?? null;
    const deadline = (t.deadline as string | null) ?? null;
    const status = t.status as TaskStatus;
    const overdue = Boolean(
      deadline &&
        deadline < nowIso &&
        status !== 'done' &&
        status !== 'archived',
    );
    return {
      id: t.id as string,
      title: t.title as string,
      status,
      priority: t.priority as TaskPriority,
      deadline,
      overdue,
      assignee: assignee || 'Non assigné',
      clientName,
      clientBrandHex: clientName
        ? getClientColor({ name: clientName, color_hex: cl?.color_hex ?? null })
        : null,
    };
  }

  const rows = tasks.map(toRow);
  const today: SupervisorTaskRow[] = [];
  const upcoming: SupervisorTaskRow[] = [];
  const overdue: SupervisorTaskRow[] = [];
  const blocked: SupervisorTaskRow[] = [];
  const completed: SupervisorTaskRow[] = [];

  for (const row of rows) {
    if (row.status === 'done') {
      completed.push(row);
      continue;
    }
    if (row.status === 'blocked') {
      blocked.push(row);
      continue;
    }
    if (row.overdue) {
      overdue.push(row);
      continue;
    }
    if (row.deadline) {
      const d = new Date(row.deadline);
      if (!Number.isNaN(d.getTime()) && isWithinInterval(d, { start: dayStart, end: dayEnd })) {
        today.push(row);
        continue;
      }
      if (d > dayEnd) {
        upcoming.push(row);
        continue;
      }
    }
    upcoming.push(row);
  }

  const members: SupervisorMemberRow[] = employees.map((e) => {
    const eid = e.id as string;
    const mine = rows.filter((t) => {
      const people = assignMap.get(t.id) ?? [];
      if (people.some((p) => p.id === eid)) return true;
      const raw = tasks.find((x) => x.id === t.id);
      return raw?.assignee_id === eid;
    });
    const active = mine.filter((t) => OPEN_STATUSES.includes(t.status));
    return {
      id: eid,
      name: e.full_name as string,
      roleLabel: ROLE_LABELS[e.role as keyof typeof ROLE_LABELS] ?? String(e.role),
      activeTaskCount: active.length,
      overdueTaskCount: active.filter((t) => t.overdue).length,
      currentTasks: active
        .filter((t) => t.status === 'in_progress' || t.status === 'review' || t.status === 'waiting_team')
        .slice(0, 4)
        .map((t) => ({ id: t.id, title: t.title, status: t.status })),
    };
  });

  return {
    department,
    departmentLabel: departmentLabel(department),
    members,
    today: today.slice(0, 20),
    upcoming: upcoming.slice(0, 20),
    overdue: overdue.slice(0, 20),
    blocked: blocked.slice(0, 20),
    completed: completed.slice(0, 20),
  };
}

export function supervisorTaskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_MAP[status]?.label ?? status;
}

export function supervisorDueCaption(row: SupervisorTaskRow): string {
  return taskDueLabel(row.deadline, row.overdue);
}
