import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import {
  effectiveRole,
  fetchManagedClientIds,
  hasFullOrgDataAccess,
  projectRowAccessible,
} from '@/lib/auth/data-scope';
import type { DocumentRecord, Invoice, Project, ProjectStatus, Task, TaskPriority } from '@/types/database';
import { clampSearchInput, parseEnumParam, parseUuidParam } from '@/lib/security/input-validation';
import { ALLOWED_PROJECT_STATUSES, ALLOWED_TASK_PRIORITIES } from '@/lib/security/query-whitelist';

export type ProjectListRow = Project & {
  clients: { id: string; name: string } | null;
  lead_name: string | null;
  task_count: number;
  invoice_count: number;
  videos_for_client: number;
};

export interface ProjectListFilters {
  search?: string;
  status?: ProjectStatus | 'all';
  type?: string | 'all';
  clientId?: string | 'all';
  priority?: TaskPriority | 'all';
}

function isProjectRouteRole(role: AuthContext['role']): boolean {
  if (!role) return false;
  if (role === 'finance' || role === 'editor' || role === 'cameraman' || role === 'community_manager') {
    return false;
  }
  return true;
}

export async function listProjectsWithStats(
  filters: ProjectListFilters = {},
  ctx: AuthContext | null = null
): Promise<ProjectListRow[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role || !isProjectRouteRole(auth.role)) return [];

  let q = supabase.from('projects').select('*, clients(id, name)').order('updated_at', { ascending: false });

  if (hasFullOrgDataAccess(auth)) {
    // tous les projets
  } else if (auth.role === 'commercial' && auth.employee) {
    const ids = await fetchManagedClientIds(supabase, auth.employee.id);
    if (!ids.length) return [];
    q = q.in('client_id', ids);
  } else {
    const er = effectiveRole(auth.role);
    const eid = auth.employee?.id;
    if (!eid || (er !== 'developer' && er !== 'seo')) return [];
    q = q.or(`lead_id.eq.${eid},team_ids.cs.{${eid}}`);
    if (er === 'seo') q = q.ilike('type', '%seo%');
  }

  const statusEq = parseEnumParam(filters.status, ALLOWED_PROJECT_STATUSES, 'all');
  if (statusEq !== 'all') q = q.eq('status', statusEq);
  if (filters.type && filters.type !== 'all') {
    const typeVal = filters.type.trim().slice(0, 160);
    if (typeVal) q = q.eq('type', typeVal);
  }
  if (filters.clientId && filters.clientId !== 'all') {
    const cid = parseUuidParam(filters.clientId);
    if (cid) q = q.eq('client_id', cid);
  }
  const pri = parseEnumParam(filters.priority, ALLOWED_TASK_PRIORITIES, 'all');
  if (pri !== 'all') q = q.eq('priority', pri);

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  type Row = Project & { clients: { id: string; name: string } | { id: string; name: string }[] | null };
  const raw = (rows ?? []) as Row[];
  const projects: (Project & { clients: { id: string; name: string } | null })[] = raw.map((r) => ({
    ...r,
    priority: (r as Project).priority ?? 'normal',
    clients: Array.isArray(r.clients) ? r.clients[0] ?? null : r.clients,
  }));

  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const clientIds = [...new Set(projects.map((p) => p.client_id))];
  const leadIds = [...new Set(projects.map((p) => p.lead_id).filter(Boolean))] as string[];

  const [leadsRes, taskRes, invRes, vidRes] = await Promise.all([
    leadIds.length ? supabase.from('employees').select('id, full_name').in('id', leadIds) : Promise.resolve({ data: [] }),
    supabase.from('tasks').select('id, project_id').in('project_id', projectIds),
    supabase.from('invoices').select('id, project_id').in('project_id', projectIds),
    supabase.from('videos').select('id, client_id').in('client_id', clientIds),
  ]);

  const leadMap = new Map((leadsRes.data ?? []).map((e: { id: string; full_name: string }) => [e.id, e.full_name]));

  const taskCount = new Map<string, number>();
  for (const t of taskRes.data ?? []) {
    const pid = (t as { project_id: string | null }).project_id;
    if (!pid) continue;
    taskCount.set(pid, (taskCount.get(pid) ?? 0) + 1);
  }

  const invCount = new Map<string, number>();
  for (const i of invRes.data ?? []) {
    const pid = (i as { project_id: string | null }).project_id;
    if (!pid) continue;
    invCount.set(pid, (invCount.get(pid) ?? 0) + 1);
  }

  const videoCountByClient = new Map<string, number>();
  for (const v of vidRes.data ?? []) {
    const row = v as { client_id: string };
    videoCountByClient.set(row.client_id, (videoCountByClient.get(row.client_id) ?? 0) + 1);
  }

  let result: ProjectListRow[] = projects.map((p) => ({
    ...p,
    lead_name: p.lead_id ? (leadMap.get(p.lead_id) ?? null) : null,
    task_count: taskCount.get(p.id) ?? 0,
    invoice_count: invCount.get(p.id) ?? 0,
    videos_for_client: videoCountByClient.get(p.client_id) ?? 0,
  }));

  const s = clampSearchInput(filters.search, 200).toLowerCase();
  if (s) {
    result = result.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        (p.clients?.name.toLowerCase().includes(s) ?? false) ||
        p.type.toLowerCase().includes(s)
    );
  }

  return result;
}

export type ProjectDetailBundle = {
  project: Project & { clients: { id: string; name: string } | null; lead_name: string | null };
  tasks: Task[];
  documents: DocumentRecord[];
  invoices: Invoice[];
  activity: Array<{
    id: string;
    action: string;
    entity_type: string;
    actor_label: string | null;
    created_at: string;
    metadata: Record<string, unknown>;
  }>;
};

export async function getProjectDetail(
  projectId: string,
  ctx: AuthContext | null = null
): Promise<ProjectDetailBundle | null> {
  if (!parseUuidParam(projectId)) return null;
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role || !isProjectRouteRole(auth.role)) return null;

  const { data: proj, error: e1 } = await supabase
    .from('projects')
    .select('*, clients(id, name)')
    .eq('id', projectId)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!proj) return null;

  type PRow = Project & { clients: { id: string; name: string } | { id: string; name: string }[] | null };
  const pr = proj as PRow;

  const accessible = await projectRowAccessible(supabase, auth, {
    client_id: pr.client_id,
    lead_id: pr.lead_id,
    team_ids: pr.team_ids ?? [],
    type: pr.type,
  });
  if (!accessible) return null;

  const clients = Array.isArray(pr.clients) ? pr.clients[0] ?? null : pr.clients;
  const project: ProjectDetailBundle['project'] = {
    ...(pr as Project),
    priority: (pr as Project).priority ?? 'normal',
    clients,
    lead_name: null,
  };

  if (project.lead_id) {
    const { data: lead } = await supabase.from('employees').select('full_name').eq('id', project.lead_id).maybeSingle();
    project.lead_name = lead?.full_name ?? null;
  }

  const [tasksRes, docsRes, invRes, logRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('project_id', projectId).order('deadline', { ascending: true, nullsFirst: false }),
    supabase.from('documents').select('*').eq('project_id', projectId).order('uploaded_at', { ascending: false }),
    supabase.from('invoices').select('*').eq('project_id', projectId).order('issue_date', { ascending: false }),
    supabase
      .from('activity_logs')
      .select('id, action, entity_type, actor_label, created_at, metadata')
      .eq('entity_type', 'project')
      .eq('entity_id', projectId)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  return {
    project,
    tasks: (tasksRes.data ?? []) as Task[],
    documents: (docsRes.data ?? []) as DocumentRecord[],
    invoices: (invRes.data ?? []) as Invoice[],
    activity: (logRes.data ?? []) as ProjectDetailBundle['activity'],
  };
}
