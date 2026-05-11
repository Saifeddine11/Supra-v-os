'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canDeleteVideo, canManageAllTasks } from '@/lib/auth/capabilities';
import {
  assertClientRecordVisible,
  assertVideoRecordVisible,
  effectiveRole,
  videoMutationDenied,
} from '@/lib/auth/data-scope';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { TaskPriority, VideoPublicStatus, VideoStatus } from '@/types/database';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { getEmployeeUserId, insertNotifications } from '@/lib/notifications/notify';
import { logStaffActivity } from '@/lib/activity/log-activity';
import {
  requireAssignableAsVideoCameraman,
  requireAssignableAsVideoEditor,
} from '@/lib/data/employee-guards';
import { legacyPrimaryAssignees, replaceVideoAssignments } from '@/lib/data/video-assignments';
import { syncVideoLinkedProductionTaskFromDb, upsertVideoProductionTask } from '@/lib/tasks/video-production-task';
import { getVideoById, type VideoWithClient } from '@/lib/data/videos';

function parseOptionalIsoTimestamp(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function deliveryDeadlineDateFromClientAt(clientDeliveryAt: string | null): string | null {
  if (!clientDeliveryAt) return null;
  return clientDeliveryAt.slice(0, 10);
}

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
}

function parseJsonIdArray(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  const t = raw.trim();
  if (!t) return [];
  try {
    const arr = JSON.parse(t) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function parseEditorCameramanIdsFromForm(formData: FormData): { editorIds: string[]; cameramanIds: string[] } {
  let editorIds = dedupeIds(parseJsonIdArray(formData.get('editor_ids')));
  let cameramanIds = dedupeIds(parseJsonIdArray(formData.get('cameraman_ids')));
  if (editorIds.length === 0) {
    const leg = String(formData.get('editor_id') ?? '').trim();
    if (leg) editorIds = [leg];
  }
  if (cameramanIds.length === 0) {
    const leg = String(formData.get('cameraman_id') ?? '').trim();
    if (leg) cameramanIds = [leg];
  }
  return { editorIds, cameramanIds };
}

/**
 * Contrôle qui peut attribuer quels rôles (permissions), pas la validité métier des compétences.
 * Les tableaux peuvent contenir la même personne en monteur et cadreur.
 */
function enforceVideoAssigneeScopeArrays(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  editorIds: string[],
  cameramanIds: string[],
):
  | { ok: true; editorIds: string[]; cameramanIds: string[] }
  | { ok: false; message: string } {
  const ed = dedupeIds(editorIds);
  const cam = dedupeIds(cameramanIds);

  if (canManageAllTasks(ctx.role) || !ctx.employee) {
    return { ok: true, editorIds: ed, cameramanIds: cam };
  }

  const eid = ctx.employee.id;
  const er = effectiveRole(ctx.role);

  if (er === 'editor') {
    if (ed.some((id) => id && id !== eid)) {
      return { ok: false, message: 'Vous ne pouvez pas attribuer un autre monteur.' };
    }
    if (cam.some((id) => id && id !== eid)) {
      return { ok: false, message: 'Seul un chef de projet peut attribuer un cadreur.' };
    }
    return { ok: true, editorIds: ed.length ? ed : [eid], cameramanIds: cam };
  }

  if (er === 'cameraman') {
    if (cam.some((id) => id && id !== eid)) {
      return { ok: false, message: 'Vous ne pouvez pas attribuer un autre cadreur.' };
    }
    if (ed.some((id) => id && id !== eid)) {
      return { ok: false, message: 'Seul un chef de projet peut attribuer un monteur.' };
    }
    return { ok: true, editorIds: ed, cameramanIds: cam.length ? cam : [eid] };
  }

  if (er === 'community_manager') {
    const onVideo = ed.includes(eid) || cam.includes(eid);
    if (!onVideo) {
      return {
        ok: false,
        message: 'Assignez-vous comme monteur ou cadreur sur cette vidéo.',
      };
    }
    return { ok: true, editorIds: ed, cameramanIds: cam };
  }

  return { ok: true, editorIds: ed, cameramanIds: cam };
}

export async function createVideoAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  if (videoMutationDenied(ctx)) return actionError('Action non autorisée pour votre rôle.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const clientId = String(formData.get('client_id') ?? '').trim();
  if (!clientId) return actionError('Le client est requis.');

  if (!(await assertClientRecordVisible(supabase, ctx, clientId))) {
    return actionError('Client non autorisé pour cette vidéo.');
  }

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le titre est requis.');

  let { editorIds, cameramanIds } = parseEditorCameramanIdsFromForm(formData);
  const shootingAt = parseOptionalIsoTimestamp(formData.get('shooting_at'));
  const clientDeliveryAt = parseOptionalIsoTimestamp(formData.get('client_delivery_at'));
  const deliveryDeadline = deliveryDeadlineDateFromClientAt(clientDeliveryAt);

  const scoped = enforceVideoAssigneeScopeArrays(ctx, editorIds, cameramanIds);
  if (!scoped.ok) return actionError(scoped.message);
  editorIds = scoped.editorIds;
  cameramanIds = scoped.cameramanIds;

  for (const eid of editorIds) {
    const edCheck = await requireAssignableAsVideoEditor(supabase, eid);
    if (!edCheck.ok) return edCheck;
  }
  for (const cid of cameramanIds) {
    const camCheck = await requireAssignableAsVideoCameraman(supabase, cid);
    if (!camCheck.ok) return camCheck;
  }

  const primary = legacyPrimaryAssignees(editorIds, cameramanIds);

  const row = {
    client_id: clientId,
    title,
    topic: String(formData.get('topic') ?? '').trim() || null,
    brief: String(formData.get('brief') ?? '').trim() || null,
    type: String(formData.get('type') ?? '').trim() || null,
    status: (String(formData.get('status') ?? 'idea') || 'idea') as VideoStatus,
    public_status: (String(formData.get('public_status') ?? 'topic_proposed') ||
      'topic_proposed') as VideoPublicStatus,
    priority: (String(formData.get('priority') ?? 'normal') || 'normal') as TaskPriority,
    editor_id: primary.editor_id,
    cameraman_id: primary.cameraman_id,
    shooting_date: shootingAt,
    client_delivery_at: clientDeliveryAt,
    delivery_deadline: deliveryDeadline,
    created_by: user.id,
  };

  const { data, error } = await supabase.from('videos').insert(row).select('id').single();
  if (error) return actionError(getPostgrestError(error));

  try {
    await replaceVideoAssignments(supabase, data.id, editorIds, cameramanIds);
  } catch (e) {
    await supabase.from('videos').delete().eq('id', data.id);
    return actionError(e instanceof Error ? e.message : 'Assignations vidéo invalides.');
  }

  const assigneeIdsForTask = [...new Set([...editorIds, ...cameramanIds])];
  const { data: clientRow } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle();
  try {
    await upsertVideoProductionTask(supabase, {
      videoId: data.id,
      title,
      clientId,
      clientName: String(clientRow?.name ?? 'Client'),
      status: row.status,
      priority: row.priority,
      shootingDate: shootingAt,
      clientDeliveryAt,
      assigneeEmployeeIds: assigneeIdsForTask,
      createdByUserId: user.id,
    });
  } catch {
    /* tâche production optionnelle : la vidéo reste valide */
  }

  await logStaffActivity(ctx, {
    action: 'created',
    entityType: 'video',
    entityId: data.id,
    metadata: { title, client_id: clientId },
  });

  revalidatePath('/videos');
  revalidatePath('/dashboard');
  revalidatePath('/tasks/calendar');
  revalidatePath('/tasks');
  return actionOk({ id: data.id });
}

export async function updateVideoAction(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  if (videoMutationDenied(ctx)) return actionError('Action non autorisée pour votre rôle.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await assertVideoRecordVisible(supabase, ctx, id))) {
    return actionError('Vidéo inaccessible.');
  }

  const clientId = String(formData.get('client_id') ?? '').trim();
  if (!clientId) return actionError('Le client est requis.');

  if (!(await assertClientRecordVisible(supabase, ctx, clientId))) {
    return actionError('Client non autorisé pour cette vidéo.');
  }

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le titre est requis.');

  let { editorIds, cameramanIds } = parseEditorCameramanIdsFromForm(formData);
  const shootingAt = parseOptionalIsoTimestamp(formData.get('shooting_at'));
  const clientDeliveryAt = parseOptionalIsoTimestamp(formData.get('client_delivery_at'));
  const deliveryDeadline = deliveryDeadlineDateFromClientAt(clientDeliveryAt);

  const scoped = enforceVideoAssigneeScopeArrays(ctx, editorIds, cameramanIds);
  if (!scoped.ok) return actionError(scoped.message);
  editorIds = scoped.editorIds;
  cameramanIds = scoped.cameramanIds;

  for (const eid of editorIds) {
    const edCheck = await requireAssignableAsVideoEditor(supabase, eid);
    if (!edCheck.ok) return edCheck;
  }
  for (const cid of cameramanIds) {
    const camCheck = await requireAssignableAsVideoCameraman(supabase, cid);
    if (!camCheck.ok) return camCheck;
  }

  const primary = legacyPrimaryAssignees(editorIds, cameramanIds);

  const { error } = await supabase
    .from('videos')
    .update({
      client_id: clientId,
      title,
      topic: String(formData.get('topic') ?? '').trim() || null,
      brief: String(formData.get('brief') ?? '').trim() || null,
      type: String(formData.get('type') ?? '').trim() || null,
      status: String(formData.get('status') ?? 'idea') as VideoStatus,
      public_status: String(formData.get('public_status') ?? 'topic_proposed') as VideoPublicStatus,
      priority: String(formData.get('priority') ?? 'normal') as TaskPriority,
      editor_id: primary.editor_id,
      cameraman_id: primary.cameraman_id,
      shooting_date: shootingAt,
      client_delivery_at: clientDeliveryAt,
      delivery_deadline: deliveryDeadline,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return actionError(getPostgrestError(error));

  try {
    await replaceVideoAssignments(supabase, id, editorIds, cameramanIds);
  } catch (e) {
    return actionError(e instanceof Error ? e.message : 'Échec mise à jour des assignations.');
  }

  const assigneeIdsForTask = [...new Set([...editorIds, ...cameramanIds])];
  const { data: vrow } = await supabase
    .from('videos')
    .select('id,title,client_id,status,priority,shooting_date,client_delivery_at')
    .eq('id', id)
    .maybeSingle();
  const { data: clientRow } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle();
  if (vrow) {
    try {
      await upsertVideoProductionTask(supabase, {
        videoId: id,
        title: vrow.title as string,
        clientId: vrow.client_id as string,
        clientName: String(clientRow?.name ?? 'Client'),
        status: vrow.status as VideoStatus,
        priority: vrow.priority as TaskPriority,
        shootingDate: (vrow.shooting_date as string | null) ?? null,
        clientDeliveryAt: (vrow.client_delivery_at as string | null) ?? null,
        assigneeEmployeeIds: assigneeIdsForTask,
        createdByUserId: user?.id ?? null,
      });
    } catch {
      /* ignore sync errors */
    }
  }

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'video',
    entityId: id,
    metadata: { title },
  });

  revalidatePath('/videos');
  revalidatePath('/dashboard');
  revalidatePath('/tasks/calendar');
  revalidatePath('/tasks');
  return actionOk();
}

export async function updateVideoStatusAction(
  id: string,
  status: VideoStatus,
  public_status?: VideoPublicStatus
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  if (videoMutationDenied(ctx)) return actionError('Action non autorisée pour votre rôle.');

  const supabase = await createClient();
  if (!(await assertVideoRecordVisible(supabase, ctx, id))) {
    return actionError('Vidéo inaccessible.');
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (public_status) patch.public_status = public_status;

  const { error } = await supabase.from('videos').update(patch).eq('id', id);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'video',
    entityId: id,
    metadata: { status, public_status: public_status ?? null },
  });

  if (status === 'sent_to_client') {
    const { data: v } = await supabase.from('videos').select('editor_id,title').eq('id', id).maybeSingle();
    const { data: asg } = await supabase
      .from('video_assignments')
      .select('employee_id')
      .eq('video_id', id)
      .eq('assignment_role', 'editor');
    const editorRecipients = new Set<string>();
    for (const r of asg ?? []) {
      if (r.employee_id) editorRecipients.add(r.employee_id as string);
    }
    if (v?.editor_id) editorRecipients.add(v.editor_id as string);
    const base = appBaseUrl();
    const rows: {
      recipient_user_id: string;
      type: 'system';
      priority: 'normal';
      title: string;
      message: string;
      related_entity_type: 'video';
      related_entity_id: string;
      link_url: string;
    }[] = [];
    for (const empId of editorRecipients) {
      const uid = await getEmployeeUserId(empId);
      if (uid && v) {
        rows.push({
          recipient_user_id: uid,
          type: 'system',
          priority: 'normal',
          title: 'Vidéo envoyée au client',
          message: String(v.title),
          related_entity_type: 'video',
          related_entity_id: id,
          link_url: `${base}/videos`,
        });
      }
    }
    if (rows.length) await insertNotifications(rows);
  }

  try {
    await syncVideoLinkedProductionTaskFromDb(supabase, id);
  } catch {
    /* sync best-effort */
  }

  revalidatePath('/videos');
  revalidatePath('/dashboard');
  revalidatePath('/tasks/calendar');
  revalidatePath('/tasks');
  return actionOk();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Détail vidéo pour deep-link / modal — respecte `assertVideoRecordVisible` via `getVideoById`. */
export async function getVideoDetailForViewerAction(
  videoId: string,
): Promise<ActionResult<VideoWithClient>> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  const id = String(videoId ?? '').trim();
  if (!id || !UUID_RE.test(id)) return actionError('Identifiant vidéo invalide.');
  try {
    const v = await getVideoById(id, ctx);
    if (!v) return actionError('Vidéo introuvable ou accès non autorisé.');
    return actionOk(v);
  } catch {
    return actionError('Vidéo introuvable ou accès non autorisé.');
  }
}

export async function getLinkedProductionTaskIdForVideoAction(
  videoId: string,
): Promise<ActionResult<{ taskId: string | null }>> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  const supabase = await createClient();
  if (!(await assertVideoRecordVisible(supabase, ctx, videoId))) {
    return actionError('Vidéo inaccessible.');
  }
  const { data, error } = await supabase.from('tasks').select('id').eq('video_id', videoId).maybeSingle();
  if (error) return actionError(getPostgrestError(error));
  const row = data as { id: string } | null;
  return actionOk({ taskId: row?.id ?? null });
}

export async function deleteVideoAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canDeleteVideo(ctx.role)) {
    return actionError('Seuls l’administrateur ou le chef de projet peuvent supprimer une vidéo.');
  }

  const supabase = await createClient();
  if (!(await assertVideoRecordVisible(supabase, ctx, id))) {
    return actionError('Vidéo inaccessible.');
  }

  const { data: v } = await supabase.from('videos').select('title').eq('id', id).maybeSingle();
  const { error } = await supabase.from('videos').delete().eq('id', id);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'deleted',
    entityType: 'video',
    entityId: id,
    metadata: { title: v?.title },
  });

  revalidatePath('/videos');
  revalidatePath('/dashboard');
  revalidatePath('/tasks/calendar');
  return actionOk();
}
