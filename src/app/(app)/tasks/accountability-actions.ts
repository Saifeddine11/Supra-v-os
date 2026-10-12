'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { resolveTaskMutationClient } from '@/lib/auth/task-mutation-client';
import { canManageAllTasks, canManageOperationalWork, canUpdateTasks } from '@/lib/auth/capabilities';
import { assertTaskRecordVisible } from '@/lib/auth/data-scope';
import { actionError, actionOk, type ActionResult } from '@/lib/actions/types';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { validatePendingTaskCompletion } from '@/lib/tasks/validate-pending-task-completion';
import type { TaskStatus } from '@/types/database';

function revalidateTasks() {
  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
}

type LoadedTask = {
  ok: true;
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
  data: {
    id: string;
    title: string;
    status: TaskStatus;
    department: string | null;
    proof_url: string | null;
    proof_note: string | null;
    deletion_request_status: string | null;
    created_by: string | null;
  };
  manages: boolean;
  writeSb: Awaited<ReturnType<typeof resolveTaskMutationClient>>;
};

async function loadWritableTask(id: string): Promise<LoadedTask | { ok: false; error: ActionResult<never> }> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: actionError('Non authentifié.') };
  if (!canUpdateTasks(ctx.role)) return { ok: false, error: actionError('Action non autorisée pour votre rôle.') };
  const readSb = await createClient();
  if (!(await assertTaskRecordVisible(readSb, ctx, id))) {
    return { ok: false, error: actionError('Tâche inaccessible.') };
  }
  const { data, error } = await readSb
    .from('tasks')
    .select('id, title, status, department, proof_url, proof_note, deletion_request_status, created_by')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return { ok: false, error: actionError('Tâche introuvable.') };
  const manages = canManageOperationalWork(ctx.role, ctx.employee?.is_department_supervisor === true);
  if (
    manages &&
    !canManageAllTasks(ctx.role) &&
    data.department !== ctx.employee?.department
  ) {
    return { ok: false, error: actionError('Cette tâche est hors de votre pôle.') };
  }
  return { ok: true, ctx, data, manages, writeSb: await resolveTaskMutationClient(ctx) };
}

export async function saveTaskProofAction(
  id: string,
  proofUrl: string,
  proofNote: string,
): Promise<ActionResult> {
  const loaded = await loadWritableTask(id);
  if (!loaded.ok) return loaded.error;
  const url = proofUrl.trim();
  const note = proofNote.trim();
  if (!url && !note) return actionError('Ajoutez un lien ou une note de preuve.');
  const { error } = await loaded.writeSb
    .from('tasks')
    .update({
      proof_url: url || null,
      proof_note: note || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return actionError(error.message);
  await logStaffActivity(loaded.ctx, {
    action: 'proof_added',
    entityType: 'task',
    entityId: id,
    metadata: { title: loaded.data.title },
  });
  revalidateTasks();
  return actionOk();
}

export async function markTaskPendingValidationAction(id: string): Promise<ActionResult> {
  const loaded = await loadWritableTask(id);
  if (!loaded.ok) return loaded.error;
  if (loaded.manages) return actionError('Utilisez la validation responsable.');
  const hasProof = Boolean(
    String(loaded.data.proof_url ?? '').trim() || String(loaded.data.proof_note ?? '').trim(),
  );
  if (!hasProof) return actionError('Ajoutez une preuve avant de marquer la tâche terminée.');
  const { error } = await loaded.writeSb
    .from('tasks')
    .update({
      status: 'completed_pending_validation' as TaskStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return actionError(error.message);
  await logStaffActivity(loaded.ctx, {
    action: 'status_updated',
    entityType: 'task',
    entityId: id,
    metadata: { title: loaded.data.title, status: 'completed_pending_validation' },
  });
  revalidateTasks();
  return actionOk();
}

export async function requestTaskDeletionAction(id: string, reason: string): Promise<ActionResult> {
  const loaded = await loadWritableTask(id);
  if (!loaded.ok) return loaded.error;
  if (loaded.manages) return actionError('La suppression responsable ne passe pas par une demande.');
  const clean = reason.trim();
  if (!clean) return actionError('Indiquez la raison de la demande.');
  if (loaded.data.deletion_request_status === 'pending') {
    return actionError('Une demande est déjà en attente.');
  }
  const { data: userData } = await (await createClient()).auth.getUser();
  const { error } = await loaded.writeSb
    .from('tasks')
    .update({
      deletion_request_status: 'pending',
      deletion_request_reason: clean,
      deletion_requested_by: userData.user?.id ?? null,
      deletion_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return actionError(error.message);
  await logStaffActivity(loaded.ctx, {
    action: 'deletion_requested',
    entityType: 'task',
    entityId: id,
    metadata: { title: loaded.data.title, reason: clean },
  });
  revalidateTasks();
  return actionOk();
}

export async function decideProposedTaskAction(
  id: string,
  decision: 'approve' | 'reject',
  reason: string,
): Promise<ActionResult> {
  const loaded = await loadWritableTask(id);
  if (!loaded.ok) return loaded.error;
  if (!loaded.manages) return actionError('Action réservée à un responsable.');
  if (loaded.data.status !== 'proposed') return actionError('Cette tâche n’est pas proposée.');
  if (decision === 'reject' && !reason.trim()) return actionError('Indiquez la raison du refus.');
  const status: TaskStatus = decision === 'approve' ? 'todo' : 'archived';
  const { error } = await loaded.writeSb
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return actionError(error.message);
  await logStaffActivity(loaded.ctx, {
    action: decision === 'approve' ? 'task_approved' : 'task_rejected',
    entityType: 'task',
    entityId: id,
    metadata: { title: loaded.data.title, reason: reason.trim() || null },
  });
  revalidateTasks();
  return actionOk();
}

export async function decideCompletionAction(
  id: string,
  decision: 'validate' | 'reject',
  reason: string,
): Promise<ActionResult> {
  const loaded = await loadWritableTask(id);
  if (!loaded.ok) return loaded.error;
  if (!loaded.manages) return actionError('Action réservée à un responsable.');
  if (loaded.data.status !== 'completed_pending_validation') {
    return actionError('Cette tâche n’est pas en attente de validation.');
  }
  if (decision === 'reject' && !reason.trim()) return actionError('Indiquez la raison du refus.');
  if (decision === 'validate') {
    const readSb = await createClient();
    return validatePendingTaskCompletion(loaded.ctx, readSb, loaded.writeSb, id);
  }
  const { error } = await loaded.writeSb
    .from('tasks')
    .update({
      status: 'in_progress' as TaskStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return actionError(error.message);
  await logStaffActivity(loaded.ctx, {
    action: 'task_rejected',
    entityType: 'task',
    entityId: id,
    metadata: { title: loaded.data.title, reason: reason.trim() || null },
  });
  revalidateTasks();
  return actionOk();
}

export async function decideDeletionAction(
  id: string,
  decision: 'approve' | 'reject',
  reason: string,
): Promise<ActionResult> {
  const loaded = await loadWritableTask(id);
  if (!loaded.ok) return loaded.error;
  if (!loaded.manages) return actionError('Action réservée à un responsable.');
  if (loaded.data.deletion_request_status !== 'pending') {
    return actionError('Aucune demande de suppression en attente.');
  }
  if (decision === 'reject' && !reason.trim()) return actionError('Indiquez la raison du refus.');
  const { data: userData } = await (await createClient()).auth.getUser();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    deletion_request_status: decision === 'approve' ? 'approved' : 'rejected',
    deletion_reviewed_at: now,
    deletion_reviewed_by: userData.user?.id ?? null,
    deletion_review_note: reason.trim() || null,
    updated_at: now,
  };
  if (decision === 'approve') {
    patch.deleted_at = now;
    patch.deleted_by = userData.user?.id ?? null;
  }
  const { error } = await loaded.writeSb.from('tasks').update(patch).eq('id', id);
  if (error) return actionError(error.message);
  await logStaffActivity(loaded.ctx, {
    action: decision === 'approve' ? 'deletion_approved' : 'deletion_rejected',
    entityType: 'task',
    entityId: id,
    metadata: { title: loaded.data.title, reason: reason.trim() || null },
  });
  revalidateTasks();
  return actionOk();
}
