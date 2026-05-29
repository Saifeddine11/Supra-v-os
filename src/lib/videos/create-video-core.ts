import 'server-only';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import {
  assertCanCreateVideo,
  assertClientRecordVisible,
  videoMutationDenied,
} from '@/lib/auth/data-scope';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TaskPriority, VideoPublicStatus, VideoStatus } from '@/types/database';
import { listClients } from '@/lib/data/clients';
import { logStaffActivity } from '@/lib/activity/log-activity';
import {
  requireAssignableAsVideoCameraman,
  requireAssignableAsVideoEditor,
} from '@/lib/data/employee-guards';
import { legacyPrimaryAssignees, replaceVideoAssignments } from '@/lib/data/video-assignments';
import { upsertVideoProductionTask } from '@/lib/tasks/video-production-task';

function formatVideoMutationDbError(err: unknown): string {
  const raw =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : getPostgrestError(err);
  const lower = raw.toLowerCase();
  if (lower.includes('row-level security') || lower.includes('rls')) {
    return 'Création impossible : permissions insuffisantes ou configuration vidéo invalide.';
  }
  return raw;
}

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

export type CreateVideoCoreInput = {
  title: string;
  description?: string | null;
  subject?: string | null;
  type?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  shootingDateIso?: string | null;
  clientDeliveryDateIso?: string | null;
  priority?: TaskPriority;
  productionStatus?: VideoStatus;
  portalStatus?: VideoPublicStatus;
  editorIds?: string[];
  cameramanIds?: string[];
  teamNotes?: string | null;
};

async function resolveClientIdForVideo(
  ctx: AuthContext,
  clientId?: string | null,
  clientName?: string | null,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();

  if (clientId?.trim()) {
    const id = clientId.trim();
    if (!(await assertClientRecordVisible(supabase, ctx, id))) {
      return actionError('Client non autorisé pour cette vidéo.');
    }
    return actionOk({ id });
  }

  const name = clientName?.trim();
  if (!name) {
    return actionError(
      'Le client est requis — précisez le nom du client ou créez la vidéo depuis /videos.',
    );
  }

  const matches = await listClients({ search: name }, ctx);
  if (matches.length === 0) {
    return actionError(
      `Client « ${name} » introuvable dans votre périmètre — vérifiez le nom ou créez la vidéo depuis /videos.`,
    );
  }

  const normalized = name.toLowerCase();
  const exact = matches.filter((m) => m.name.trim().toLowerCase() === normalized);
  if (exact.length === 1) {
    return actionOk({ id: exact[0].id });
  }
  if (exact.length > 1) {
    return actionError(
      `Plusieurs clients correspondent à « ${name} » — précisez le nom exact.`,
    );
  }
  if (matches.length === 1) {
    return actionOk({ id: matches[0].id });
  }

  return actionError(
    `Client « ${name} » ambigu (${matches.length} résultats) — précisez le nom exact.`,
  );
}

export async function createVideoCore(
  ctx: AuthContext,
  input: CreateVideoCoreInput,
): Promise<ActionResult<{ id: string }>> {
  if (!ctx.role) {
    return actionError(
      'Profil employé introuvable ou sans rôle : contactez un administrateur pour lier votre compte.',
    );
  }

  const createDenied = assertCanCreateVideo(ctx);
  if (createDenied) return actionError(createDenied);
  if (videoMutationDenied(ctx)) {
    return actionError('Action non autorisée pour votre rôle.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const title = input.title.trim();
  if (!title) return actionError('Le titre est requis.');

  const clientResolved = await resolveClientIdForVideo(ctx, input.clientId, input.clientName);
  if (!clientResolved.ok) return clientResolved;
  const clientId = clientResolved.data!.id;

  const shootingAt = parseOptionalIsoTimestamp(input.shootingDateIso);
  const clientDeliveryAt = parseOptionalIsoTimestamp(input.clientDeliveryDateIso);
  const deliveryDeadline = deliveryDeadlineDateFromClientAt(clientDeliveryAt);

  let editorIds = dedupeIds(input.editorIds ?? []);
  let cameramanIds = dedupeIds(input.cameramanIds ?? []);

  for (const eid of editorIds) {
    const edCheck = await requireAssignableAsVideoEditor(supabase, eid);
    if (!edCheck.ok) return edCheck;
  }
  for (const cid of cameramanIds) {
    const camCheck = await requireAssignableAsVideoCameraman(supabase, cid);
    if (!camCheck.ok) return camCheck;
  }

  const primary = legacyPrimaryAssignees(editorIds, cameramanIds);

  const topic = input.subject?.trim() || null;
  let brief = input.description?.trim() || null;
  const teamNotes = input.teamNotes?.trim();
  if (teamNotes) {
    brief = brief ? `${brief}\n\n${teamNotes}` : teamNotes;
  }

  const row = {
    client_id: clientId,
    title,
    topic,
    brief,
    type: input.type?.trim() || null,
    status: (input.productionStatus ?? 'idea') as VideoStatus,
    public_status: (input.portalStatus ?? 'topic_proposed') as VideoPublicStatus,
    priority: (input.priority ?? 'normal') as TaskPriority,
    editor_id: primary.editor_id,
    cameraman_id: primary.cameraman_id,
    shooting_date: shootingAt,
    client_delivery_at: clientDeliveryAt,
    delivery_deadline: deliveryDeadline,
    created_by: user.id,
  };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return actionError(
      'Création impossible : configuration serveur incomplète. Contactez l’administrateur.',
    );
  }

  const { data, error } = await admin.from('videos').insert(row).select('id').single();
  if (error) {
    console.error('[createVideoCore] insert videos:', error);
    return actionError(formatVideoMutationDbError(error));
  }

  try {
    await replaceVideoAssignments(admin, data.id, editorIds, cameramanIds);
  } catch (e) {
    await admin.from('videos').delete().eq('id', data.id);
    console.error('[createVideoCore] video_assignments:', e);
    return actionError(formatVideoMutationDbError(e));
  }

  const assigneeIdsForTask = [...new Set([...editorIds, ...cameramanIds])];
  const { data: clientRow } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .maybeSingle();
  try {
    await upsertVideoProductionTask(admin, {
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
    /* tâche production optionnelle */
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

  return actionOk({ id: data.id });
}
