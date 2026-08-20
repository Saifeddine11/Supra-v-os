'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { portalVideoAllowsClientAction, validatePortalToken } from '@/lib/portal/validate';
import { emailStaffAboutClientFeedback } from '@/lib/portal/portal-staff-email';
import { logPortalActivity, notifyAdminsAndPMs } from '@/lib/portal/notify-staff';
import { scheduleVideoKanbanAdvancement } from '@/lib/discord/kanban-advancement';
import { joinedRelationName } from '@/lib/supabase/joined-name';
import { actionError, actionOk, type ActionResult } from '@/lib/actions/types';

export async function portalApproveVideoAction(
  clientId: string,
  videoId: string,
  token: string
): Promise<ActionResult> {
  const v = await validatePortalToken(clientId, token);
  if (!v.ok) return actionError('Lien invalide ou portail inactif.');

  const admin = createAdminClient();
  const { data: video } = await admin
    .from('videos')
    .select('id, client_id, title, status, public_status, clients(name)')
    .eq('id', videoId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (!video) return actionError('Vidéo introuvable.');
  if (!portalVideoAllowsClientAction(video)) {
    return actionError('Cette vidéo n’est pas en attente de validation côté client.');
  }

  const { error } = await admin
    .from('videos')
    .update({
      status: 'validated',
      public_status: 'validated',
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId);

  if (error) return actionError(error.message);

  scheduleVideoKanbanAdvancement(videoId, video.status, 'validated');

  await notifyAdminsAndPMs({
    title: 'Validation client',
    message: `Le client a validé la vidéo « ${video.title} ».`,
    type: 'client_validated',
    relatedEntityType: 'video',
    relatedEntityId: videoId,
    linkUrl: `/videos`,
  });

  const clientName = joinedRelationName((video as { clients?: unknown }).clients) ?? 'Client';
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
    metadata: { client_id: clientId, video_title: video.title },
  });

  return actionOk();
}

export async function portalRequestRevisionAction(
  clientId: string,
  videoId: string,
  token: string,
  comment: string
): Promise<ActionResult> {
  const body = comment.trim();
  if (!body) return actionError('Merci de décrire les modifications souhaitées.');

  const v = await validatePortalToken(clientId, token);
  if (!v.ok) return actionError('Lien invalide ou portail inactif.');

  const admin = createAdminClient();
  const { data: video } = await admin
    .from('videos')
    .select('id, client_id, title, revision_count, status, public_status, clients(name)')
    .eq('id', videoId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (!video) return actionError('Vidéo introuvable.');
  if (!portalVideoAllowsClientAction(video)) {
    return actionError('Cette vidéo n’est pas en attente de validation côté client.');
  }

  const nextRev = (video.revision_count ?? 0) + 1;

  const { error } = await admin
    .from('videos')
    .update({
      status: 'client_revision',
      public_status: 'revision_requested',
      client_feedback: body,
      revision_count: nextRev,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId);

  if (error) return actionError(error.message);

  await admin.from('comments').insert({
    entity_type: 'video',
    entity_id: videoId,
    author_id: null,
    body: `[Portail client] ${body}`,
    is_internal: false,
  });

  await notifyAdminsAndPMs({
    title: 'Révision demandée',
    message: `Le client demande une révision pour « ${video.title} ».`,
    type: 'client_revision_requested',
    relatedEntityType: 'video',
    relatedEntityId: videoId,
    linkUrl: `/videos`,
  });

  const clientName = joinedRelationName((video as { clients?: unknown }).clients) ?? 'Client';
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
    metadata: { client_id: clientId },
  });

  return actionOk();
}
