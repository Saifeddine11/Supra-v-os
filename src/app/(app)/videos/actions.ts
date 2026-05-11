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

/**
 * Contrôle qui peut attribuer quels rôles (permissions), pas la validité métier des compétences.
 * `editor_id` et `cameraman_id` peuvent être le même employé si les gardes compétences le permettent.
 */
function enforceVideoAssigneeScope(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  editorId: string,
  cameramanId: string
):
  | { ok: true; editorId: string | null; cameramanId: string | null }
  | { ok: false; message: string } {
  if (canManageAllTasks(ctx.role) || !ctx.employee) {
    return { ok: true, editorId: editorId || null, cameramanId: cameramanId || null };
  }

  const eid = ctx.employee.id;
  const er = effectiveRole(ctx.role);

  if (er === 'editor') {
    if (editorId && editorId !== eid) {
      return { ok: false, message: 'Vous ne pouvez pas attribuer un autre monteur.' };
    }
    if (cameramanId && cameramanId !== eid) {
      return { ok: false, message: 'Seul un chef de projet peut attribuer un cadreur.' };
    }
    return { ok: true, editorId: eid, cameramanId: cameramanId ? cameramanId : null };
  }

  if (er === 'cameraman') {
    if (cameramanId && cameramanId !== eid) {
      return { ok: false, message: 'Vous ne pouvez pas attribuer un autre cadreur.' };
    }
    if (editorId && editorId !== eid) {
      return { ok: false, message: 'Seul un chef de projet peut attribuer un monteur.' };
    }
    return { ok: true, editorId: editorId ? editorId : null, cameramanId: eid };
  }

  if (er === 'community_manager') {
    const onVideo = editorId === eid || cameramanId === eid;
    if (!onVideo) {
      return {
        ok: false,
        message: 'Assignez-vous comme monteur ou cadreur sur cette vidéo.',
      };
    }
    return { ok: true, editorId: editorId || null, cameramanId: cameramanId || null };
  }

  return { ok: true, editorId: editorId || null, cameramanId: cameramanId || null };
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

  let editorId = String(formData.get('editor_id') ?? '').trim();
  let cameramanId = String(formData.get('cameraman_id') ?? '').trim();
  const shootingAt = parseOptionalIsoTimestamp(formData.get('shooting_at'));
  const clientDeliveryAt = parseOptionalIsoTimestamp(formData.get('client_delivery_at'));
  const deliveryDeadline = deliveryDeadlineDateFromClientAt(clientDeliveryAt);

  const scoped = enforceVideoAssigneeScope(ctx, editorId, cameramanId);
  if (!scoped.ok) return actionError(scoped.message);
  editorId = scoped.editorId ?? '';
  cameramanId = scoped.cameramanId ?? '';

  const edCheck = await requireAssignableAsVideoEditor(supabase, editorId || null);
  if (!edCheck.ok) return edCheck;
  const camCheck = await requireAssignableAsVideoCameraman(supabase, cameramanId || null);
  if (!camCheck.ok) return camCheck;

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
    editor_id: editorId || null,
    cameraman_id: cameramanId || null,
    shooting_date: shootingAt,
    client_delivery_at: clientDeliveryAt,
    delivery_deadline: deliveryDeadline,
    created_by: user.id,
  };

  const { data, error } = await supabase.from('videos').insert(row).select('id').single();
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'created',
    entityType: 'video',
    entityId: data.id,
    metadata: { title, client_id: clientId },
  });

  revalidatePath('/videos');
  revalidatePath('/dashboard');
  revalidatePath('/tasks/calendar');
  return actionOk({ id: data.id });
}

export async function updateVideoAction(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  if (videoMutationDenied(ctx)) return actionError('Action non autorisée pour votre rôle.');

  const supabase = await createClient();
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

  let editorId = String(formData.get('editor_id') ?? '').trim();
  let cameramanId = String(formData.get('cameraman_id') ?? '').trim();
  const shootingAt = parseOptionalIsoTimestamp(formData.get('shooting_at'));
  const clientDeliveryAt = parseOptionalIsoTimestamp(formData.get('client_delivery_at'));
  const deliveryDeadline = deliveryDeadlineDateFromClientAt(clientDeliveryAt);

  const scoped = enforceVideoAssigneeScope(ctx, editorId, cameramanId);
  if (!scoped.ok) return actionError(scoped.message);
  editorId = scoped.editorId ?? '';
  cameramanId = scoped.cameramanId ?? '';

  const edCheck = await requireAssignableAsVideoEditor(supabase, editorId || null);
  if (!edCheck.ok) return edCheck;
  const camCheck = await requireAssignableAsVideoCameraman(supabase, cameramanId || null);
  if (!camCheck.ok) return camCheck;

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
      editor_id: editorId || null,
      cameraman_id: cameramanId || null,
      shooting_date: shootingAt,
      client_delivery_at: clientDeliveryAt,
      delivery_deadline: deliveryDeadline,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'video',
    entityId: id,
    metadata: { title },
  });

  revalidatePath('/videos');
  revalidatePath('/dashboard');
  revalidatePath('/tasks/calendar');
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
    const uid = await getEmployeeUserId(v?.editor_id ?? null);
    if (uid && v) {
      const base = appBaseUrl();
      await insertNotifications([
        {
          recipient_user_id: uid,
          type: 'system',
          priority: 'normal',
          title: 'Vidéo envoyée au client',
          message: v.title,
          related_entity_type: 'video',
          related_entity_id: id,
          link_url: `${base}/videos`,
        },
      ]);
    }
  }

  revalidatePath('/videos');
  revalidatePath('/dashboard');
  revalidatePath('/tasks/calendar');
  return actionOk();
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
