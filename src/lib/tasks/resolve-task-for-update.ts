import 'server-only';

import type { AuthContext } from '@/lib/auth/permissions';
import { canManageAllTasks } from '@/lib/auth/capabilities';
import { getTaskById, listTasksEnriched } from '@/lib/data/tasks';
import type { TaskEnriched } from '@/types/database';
import { parseUuidParam } from '@/lib/security/input-validation';

export type TaskLookupMatch = {
  id: string;
  title: string;
  clientName: string | null;
  assigneeName: string | null;
};

export type TaskLookupResult =
  | { status: 'resolved'; task: TaskEnriched }
  | { status: 'not_found'; query: string }
  | { status: 'ambiguous'; query: string; matches: TaskLookupMatch[] };

function normalizeQuery(text: string): string {
  return text.trim().toLowerCase();
}

function toMatch(task: TaskEnriched): TaskLookupMatch {
  return {
    id: task.id,
    title: task.title,
    clientName: task.client_name,
    assigneeName: task.assignee_name,
  };
}

function rankMatches(tasks: TaskEnriched[], query: string): TaskEnriched[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  const exact = tasks.filter((t) => normalizeQuery(t.title) === q);
  if (exact.length === 1) return exact;
  if (exact.length > 1) return exact;

  const contains = tasks.filter((t) => normalizeQuery(t.title).includes(q));
  if (contains.length === 1) return contains;

  const reverseContains = tasks.filter((t) => q.includes(normalizeQuery(t.title)));
  if (reverseContains.length === 1) return reverseContains;

  const combined = [...new Map([...contains, ...reverseContains].map((t) => [t.id, t])).values()];
  return combined;
}

export async function lookupTaskForUpdate(
  ctx: AuthContext,
  opts: { taskId?: string | null; taskSearchText?: string | null },
): Promise<TaskLookupResult> {
  if (!ctx.role || !canManageAllTasks(ctx.role)) {
    return { status: 'not_found', query: opts.taskSearchText?.trim() || opts.taskId || '' };
  }

  const taskId = opts.taskId?.trim();
  if (taskId && parseUuidParam(taskId)) {
    const task = await getTaskById(taskId, ctx);
    if (task) return { status: 'resolved', task };
    return { status: 'not_found', query: taskId };
  }

  const query = opts.taskSearchText?.trim() ?? '';
  if (!query) {
    return { status: 'not_found', query: '' };
  }

  const tasks = await listTasksEnriched({ search: query }, ctx);
  const ranked = rankMatches(tasks, query);

  if (ranked.length === 1) {
    return { status: 'resolved', task: ranked[0]! };
  }

  if (ranked.length > 1) {
    return {
      status: 'ambiguous',
      query,
      matches: ranked.slice(0, 8).map(toMatch),
    };
  }

  return { status: 'not_found', query };
}
