import 'server-only';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthContext } from '@/lib/auth/permissions';
import { canManageAllTasks, canManageOperationalWork, canUpdateTasks } from '@/lib/auth/capabilities';
import { assertTaskRecordVisible } from '@/lib/auth/data-scope';
import { actionError, actionOk, type ActionResult } from '@/lib/actions/types';
import { syncVideoAfterValidatedShootingTask } from '@/lib/tasks/sync-video-after-shooting-task-done';
import type { TaskStatus } from '@/types/database';

/**
 * Responsible validation: `completed_pending_validation` → `done`.
 * Does not accept an employee completion request as final.
 */
export async function validatePendingTaskCompletion(
  ctx: AuthContext,
  readSb: SupabaseClient,
  writeSb: SupabaseClient,
  taskId: string,
): Promise<ActionResult> {
  if (!canUpdateTasks(ctx.role)) return actionError('Action non autorisée pour votre rôle.');
  const manages = canManageOperationalWork(ctx.role, ctx.employee?.is_department_supervisor === true);
  if (!manages) return actionError('Action réservée à un responsable.');
  if (!ctx.employee?.is_active || ctx.employee.archived_at) {
    return actionError('Compte employé inactif : action désactivée.');
  }

  if (!(await assertTaskRecordVisible(readSb, ctx, taskId))) {
    return actionError('Tâche inaccessible.');
  }

  const { data, error: readErr } = await readSb
    .from('tasks')
    .select('id, title, status, department')
    .eq('id', taskId)
    .maybeSingle();
  if (readErr || !data) return actionError('Tâche introuvable.');
  if (data.status !== 'completed_pending_validation') {
    return actionError('Cette tâche n’est pas en attente de validation.');
  }
  if (!canManageAllTasks(ctx.role) && data.department !== ctx.employee.department) {
    return actionError('Cette tâche est hors de votre pôle.');
  }

  const now = new Date().toISOString();
  const { error } = await writeSb
    .from('tasks')
    .update({
      status: 'done' as TaskStatus,
      completed_at: now,
      updated_at: now,
    })
    .eq('id', taskId);
  if (error) return actionError(error.message);

  const { error: logErr } = await writeSb.from('activity_logs').insert({
    actor_user_id: ctx.userId,
    actor_label: ctx.employee.full_name?.trim() || ctx.email || null,
    action: 'task_validated',
    entity_type: 'task',
    entity_id: taskId,
    metadata: { title: data.title, reason: null },
  });
  if (logErr) console.error('[validatePendingTaskCompletion] activity', logErr.message);

  await syncVideoAfterValidatedShootingTask({
    ctx,
    taskId,
    previousStatus: 'completed_pending_validation',
    nextStatus: 'done',
  });

  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
  revalidatePath('/videos');
  return actionOk();
}
