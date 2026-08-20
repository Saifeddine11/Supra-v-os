/**
 * Task creation (admin / project_manager) — mirrors the web's createTaskCore
 * (src/lib/tasks/create-task-core.ts) through RLS instead of the service role:
 *
 *  - insert `tasks` via tasks_insert_operational (admin/PM allowed)
 *  - insert `task_assignments` via task_assignments_insert_operational,
 *    with the web's rollback (delete the task) if the pivot insert fails
 *  - activity log + task_assigned notifications, same as the web
 *    (both tables allow authenticated inserts by policy)
 *
 * The pickers only list RLS-visible clients and active employees, so the
 * "client visible" and "assignable employee" web guards hold by construction.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logDevError, toUserMessage } from '@/lib/errors';
import { validateFutureDeadline } from '@/lib/validate-future-date';
import { webTaskLink } from '@/lib/web-links';
import type { TaskPriority } from '@/types/db';

export interface ClientOption {
  id: string;
  name: string;
}

export interface EmployeeOption {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  avatar_color: string | null;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  deadline: Date | null;
  priority: TaskPriority;
  clientId: string | null;
  assigneeIds: string[];
}

const CREATE_FAILED_MSG = 'La création de la tâche a échoué. Réessayez.';
const CREATE_DENIED_MSG = 'Vous n’avez pas l’autorisation de créer une tâche.';

/** RLS-scoped client options (≤ 30, optional name search). */
export function useClientOptions(search: string) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let q = supabase.from('clients').select('id, name').order('name').limit(30);
        const term = search.trim();
        if (term.length > 0) {
          q = q.ilike('name', `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
        }
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        if (mounted) setClients((data ?? []) as ClientOption[]);
      } catch (e) {
        logDevError('useClientOptions', e);
        if (mounted) setClients([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [search]);

  return { clients, loading };
}

/** Active, non-archived employees visible through RLS (≤ 30). */
export function useEmployeeOptions() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, full_name, avatar_initials, avatar_color')
          .eq('is_active', true)
          .is('archived_at', null)
          .order('full_name')
          .limit(30);
        if (error) throw new Error(error.message);
        if (mounted) setEmployees((data ?? []) as EmployeeOption[]);
      } catch (e) {
        logDevError('useEmployeeOptions', e);
        if (mounted) setEmployees([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { employees, loading };
}

/** Best-effort side effects — never block the creation result (web parity). */
async function afterCreateSideEffects(
  taskId: string,
  title: string,
  assigneeIds: string[],
  actorUserId: string,
  actorLabel: string | null,
): Promise<void> {
  try {
    await supabase.from('activity_logs').insert({
      actor_user_id: actorUserId,
      actor_label: actorLabel,
      action: 'created',
      entity_type: 'task',
      entity_id: taskId,
      metadata: { title, via: 'mobile' },
    });
  } catch (e) {
    logDevError('createTask:activityLog', e);
  }

  if (assigneeIds.length === 0) return;
  try {
    // employee → auth user mapping (same as the web's getEmployeeUserId).
    const { data } = await supabase
      .from('employees')
      .select('id, user_id')
      .in('id', assigneeIds);
    const rows = ((data ?? []) as { id: string; user_id: string | null }[])
      .filter((r) => r.user_id)
      .map((r) => ({
        recipient_user_id: r.user_id as string,
        type: 'task_assigned',
        priority: 'normal',
        title: 'Nouvelle tâche assignée',
        message: title,
        related_entity_type: 'task',
        related_entity_id: taskId,
        // Web click-through — same deep-link pattern as the web's
        // hrefTasksOpenDetail (/tasks?highlight=<id>).
        link_url: webTaskLink(taskId),
      }));
    if (rows.length > 0) {
      await supabase.from('notifications').insert(rows);
    }
  } catch (e) {
    logDevError('createTask:notify', e);
  }
}

export async function createTask(
  input: CreateTaskInput,
  actorLabel: string | null,
): Promise<{ id: string | null; error: string | null }> {
  const title = input.title.trim();
  if (!title) return { id: null, error: 'Le titre est requis.' };

  if (input.deadline) {
    const check = validateFutureDeadline(input.deadline);
    if (!check.ok) return { id: null, error: check.message };
  }

  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user?.id;
  if (!userId) return { id: null, error: 'Session expirée. Veuillez vous reconnecter.' };

  const assigneeIds = [...new Set(input.assigneeIds.filter(Boolean))];

  const row = {
    title,
    description: input.description.trim() || null,
    client_id: input.clientId || null,
    assignee_id: assigneeIds[0] ?? null,
    status: 'todo',
    priority: input.priority,
    deadline: input.deadline ? input.deadline.toISOString() : null,
    created_by: userId,
  };

  const { data, error } = await supabase.from('tasks').insert(row).select('id').single();
  if (error || !data) {
    logDevError('createTask:insert', error);
    if (error && /row-level security|rls|permission denied|policy/i.test(error.message)) {
      return { id: null, error: CREATE_DENIED_MSG };
    }
    return { id: null, error: toUserMessage(error, CREATE_FAILED_MSG) };
  }
  const taskId = data.id as string;

  if (assigneeIds.length > 0) {
    const { error: pivotError } = await supabase
      .from('task_assignments')
      .insert(assigneeIds.map((employeeId) => ({ task_id: taskId, employee_id: employeeId })));
    if (pivotError) {
      // Web parity: roll the task back rather than leaving it half-created.
      logDevError('createTask:assignments', pivotError);
      await supabase.from('tasks').delete().eq('id', taskId);
      return { id: null, error: toUserMessage(pivotError, CREATE_FAILED_MSG) };
    }
  }

  await afterCreateSideEffects(taskId, title, assigneeIds, userId, actorLabel);
  return { id: taskId, error: null };
}
