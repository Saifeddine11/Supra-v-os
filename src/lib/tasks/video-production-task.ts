import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskPriority, TaskStatus, VideoStatus } from '@/types/database';
import { replaceTaskAssignments, legacyPrimaryAssignee } from '@/lib/data/task-assignments';

type SB = SupabaseClient;

export function taskStatusFromVideoStatus(status: VideoStatus): TaskStatus {
  switch (status) {
    case 'idea':
    case 'brief_pending':
    case 'brief_validated':
      return 'todo';
    case 'shooting_planned':
    case 'shooting_in_progress':
    case 'shooting_done':
    case 'rushes_received':
    case 'editing':
    case 'internal_review':
      return 'in_progress';
    case 'sent_to_client':
    case 'client_revision':
      return 'waiting_client';
    case 'validated':
    case 'published':
      return 'done';
    case 'archived':
    case 'cancelled':
      return 'archived';
    default:
      return 'in_progress';
  }
}

function formatIsoDateFr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

function buildVideoProductionDescription(opts: {
  clientName: string;
  shooting: string | null;
  delivery: string | null;
}): string {
  const lines = [`Production vidéo liée à ${opts.clientName}.`];
  if (opts.shooting) lines.push(`Tournage : ${opts.shooting}`);
  if (opts.delivery) lines.push(`Livraison client : ${opts.delivery}`);
  return lines.join('\n');
}

function taskDeadlineFromVideo(shootingDate: string | null, clientDeliveryAt: string | null): string | null {
  if (clientDeliveryAt) return new Date(clientDeliveryAt).toISOString();
  if (shootingDate) return new Date(shootingDate).toISOString();
  return null;
}

export interface SyncVideoProductionTaskInput {
  videoId: string;
  title: string;
  clientId: string;
  clientName: string;
  status: VideoStatus;
  priority: TaskPriority;
  shootingDate: string | null;
  clientDeliveryAt: string | null;
  /** Monteurs + cadreurs, sans doublon. */
  assigneeEmployeeIds: string[];
  createdByUserId: string | null;
}

/**
 * Une vidéo = une tâche liée (tasks.video_id unique). Crée ou met à jour titre, client, échéance, statut, assignés.
 */
export async function upsertVideoProductionTask(sb: SB, input: SyncVideoProductionTaskInput): Promise<void> {
  const assignees = [...new Set(input.assigneeEmployeeIds.map((x) => x.trim()).filter(Boolean))];
  const primary = legacyPrimaryAssignee(assignees);
  const taskStatus = taskStatusFromVideoStatus(input.status);
  const deadline = taskDeadlineFromVideo(input.shootingDate, input.clientDeliveryAt);
  const desc = buildVideoProductionDescription({
    clientName: input.clientName,
    shooting: formatIsoDateFr(input.shootingDate),
    delivery: formatIsoDateFr(input.clientDeliveryAt),
  });

  const { data: existing, error: findErr } = await sb.from('tasks').select('id').eq('video_id', input.videoId).maybeSingle();
  if (findErr) throw new Error(findErr.message);

  const title = `Vidéo — ${input.title}`;

  if (existing?.id) {
    const taskId = existing.id as string;
    const { error: upErr } = await sb
      .from('tasks')
      .update({
        title,
        description: desc,
        client_id: input.clientId,
        status: taskStatus,
        priority: input.priority,
        deadline,
        assignee_id: primary.assignee_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    if (upErr) throw new Error(upErr.message);
    await replaceTaskAssignments(sb, taskId, assignees);
    return;
  }

  const row = {
    title,
    description: desc,
    client_id: input.clientId,
    video_id: input.videoId,
    assignee_id: primary.assignee_id,
    status: taskStatus,
    priority: input.priority,
    deadline,
    created_by: input.createdByUserId,
  };
  const { data: inserted, error: insErr } = await sb.from('tasks').insert(row).select('id').single();
  if (insErr) throw new Error(insErr.message);
  await replaceTaskAssignments(sb, inserted.id as string, assignees);
}

/** Ajoute un paragraphe en fin de description de la tâche production liée à la vidéo. */
export async function appendNoteToVideoProductionTask(sb: SB, videoId: string, paragraph: string): Promise<void> {
  const note = paragraph.trim();
  if (!note) return;
  const { data: t, error } = await sb.from('tasks').select('id, description').eq('video_id', videoId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!t?.id) return;
  const prev = String((t as { description: string | null }).description ?? '').trim();
  const block = prev ? `\n\n${note}` : note;
  const { error: up } = await sb
    .from('tasks')
    .update({
      description: prev ? `${prev}${block}` : note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', t.id as string);
  if (up) throw new Error(up.message);
}

/** Recharge la vidéo + assignations et resynchronise la tâche production (ex. changement de statut). */
export async function syncVideoLinkedProductionTaskFromDb(sb: SB, videoId: string): Promise<void> {
  const { data: vfull, error } = await sb
    .from('videos')
    .select(
      'id,title,client_id,status,priority,shooting_date,client_delivery_at,editor_id,cameraman_id',
    )
    .eq('id', videoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!vfull) return;

  const { data: va, error: e2 } = await sb.from('video_assignments').select('employee_id').eq('video_id', videoId);
  if (e2) throw new Error(e2.message);
  const ids = new Set<string>();
  for (const r of va ?? []) {
    if (r.employee_id) ids.add(r.employee_id as string);
  }
  if (vfull.editor_id) ids.add(vfull.editor_id as string);
  if (vfull.cameraman_id) ids.add(vfull.cameraman_id as string);

  const { data: cname } = await sb.from('clients').select('name').eq('id', vfull.client_id).maybeSingle();

  await upsertVideoProductionTask(sb, {
    videoId,
    title: vfull.title as string,
    clientId: vfull.client_id as string,
    clientName: String(cname?.name ?? 'Client'),
    status: vfull.status as VideoStatus,
    priority: vfull.priority as TaskPriority,
    shootingDate: (vfull.shooting_date as string | null) ?? null,
    clientDeliveryAt: (vfull.client_delivery_at as string | null) ?? null,
    assigneeEmployeeIds: [...ids],
    createdByUserId: null,
  });
}
