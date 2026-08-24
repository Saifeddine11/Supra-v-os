import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireClientAuth } from '@/lib/clients/session';
import { parseUuidParam } from '@/lib/security/input-validation';
import { assertOwnedByAuthenticatedClient } from '@/lib/clients/ownership';
import { portalVideoAllowsClientAction } from '@/lib/portal/validate';
import { emailStaffAboutClientFeedback } from '@/lib/portal/portal-staff-email';
import { logPortalActivity, notifyAdminsAndPMs } from '@/lib/portal/notify-staff';
import { scheduleVideoKanbanAdvancement } from '@/lib/discord/kanban-advancement';
import { joinedRelationName } from '@/lib/supabase/joined-name';
import { actionError, actionOk, type ActionResult } from '@/lib/actions/types';

async function loadOwnedVideo(videoId: string, clientId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('videos')
    .select('id, client_id, title, status, public_status, revision_count, clients(name)')
    .eq('id', videoId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (!data) return null;
  if (assertOwnedByAuthenticatedClient(data.client_id as string, clientId) !== 'ok') return null;
  return data;
}

export async function approveClientVideo(rawVideoId: string): Promise<ActionResult> {
  const session = await requireClientAuth();
  const videoId = parseUuidParam(rawVideoId);
  if (!videoId) return actionError('Vidéo introuvable.');

  const video = await loadOwnedVideo(videoId, session.clientId);
  if (!video) return actionError('Vidéo introuvable.');
  if (!portalVideoAllowsClientAction(video)) {
    return actionError('Cette vidéo n’est pas en attente de validation.');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('videos')
    .update({
      status: 'validated',
      public_status: 'validated',
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId)
    .eq('client_id', session.clientId);

  if (error) {
    console.error('[client-video] validate failed', error.message);
    return actionError('Impossible d’enregistrer la validation. Réessayez.');
  }

  scheduleVideoKanbanAdvancement(videoId, video.status, 'validated');

  await notifyAdminsAndPMs({
    title: 'Validation client',
    message: `Le client a validé la vidéo « ${video.title} ».`,
    type: 'client_validated',
    relatedEntityType: 'video',
    relatedEntityId: videoId,
    linkUrl: '/videos',
  });

  const clientName =
    joinedRelationName((video as { clients?: unknown }).clients) ?? session.clientName ?? 'Client';
  await emailStaffAboutClientFeedback({
    clientName,
    entityTitle: video.title,
    feedbackType: 'approved',
    comment: null,
    entityPath: '/videos',
  });

  await logPortalActivity({
    action: 'video_validated_by_client',
    entityType: 'video',
    entityId: videoId,
    metadata: { client_id: session.clientId, video_title: video.title, source: 'authenticated_client' },
  });

  return actionOk();
}

export async function requestClientVideoRevision(
  rawVideoId: string,
  comment: string,
): Promise<ActionResult> {
  const session = await requireClientAuth();
  const videoId = parseUuidParam(rawVideoId);
  if (!videoId) return actionError('Vidéo introuvable.');

  const body = comment.trim();
  if (!body) return actionError('Merci de décrire les modifications souhaitées.');

  const video = await loadOwnedVideo(videoId, session.clientId);
  if (!video) return actionError('Vidéo introuvable.');
  if (!portalVideoAllowsClientAction(video)) {
    return actionError('Cette vidéo n’est pas en attente de validation.');
  }

  const nextRev = (Number(video.revision_count ?? 0) || 0) + 1;
  const admin = createAdminClient();
  const { error } = await admin
    .from('videos')
    .update({
      status: 'client_revision',
      public_status: 'revision_requested',
      client_feedback: body,
      revision_count: nextRev,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId)
    .eq('client_id', session.clientId);

  if (error) {
    console.error('[client-video] revision failed', error.message);
    return actionError('Impossible d’enregistrer votre demande. Réessayez.');
  }

  await admin.from('comments').insert({
    entity_type: 'video',
    entity_id: videoId,
    author_id: null,
    body: `[Espace client] ${body}`,
    is_internal: false,
  });

  await notifyAdminsAndPMs({
    title: 'Révision demandée',
    message: `Le client demande une révision pour « ${video.title} ».`,
    type: 'client_revision_requested',
    relatedEntityType: 'video',
    relatedEntityId: videoId,
    linkUrl: '/videos',
  });

  const clientName =
    joinedRelationName((video as { clients?: unknown }).clients) ?? session.clientName ?? 'Client';
  await emailStaffAboutClientFeedback({
    clientName,
    entityTitle: video.title,
    feedbackType: 'revision_requested',
    comment: body,
    entityPath: '/videos',
  });

  await logPortalActivity({
    action: 'video_revision_requested_by_client',
    entityType: 'video',
    entityId: videoId,
    metadata: { client_id: session.clientId, source: 'authenticated_client' },
  });

  return actionOk();
}
