import type { AiVideoDraftPayload } from '@/lib/ai/video-draft-schema';
import { AI_VIDEO_PRODUCTION_STATUSES } from '@/lib/ai/video-draft-schema';
import { parseFrenchDateText } from '@/lib/ai/parse-task-deadline';
import {
  isStructuredVideoTemplate,
  parseLabeledFieldBlock,
  pickField,
} from '@/lib/ai/parse-structured-template';

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function capitalizeName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => capitalizeFirst(part.toLowerCase()))
    .join(' ');
}

function cleanTitleValue(value: string): string {
  return capitalizeFirst(
    value
      .replace(/^(titre|title)\s*:\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160),
  );
}

function mapVideoPriority(value?: string): AiVideoDraftPayload['priority'] {
  const v = (value ?? '').trim().toLowerCase();
  if (/urgent/.test(v)) return 'urgent';
  if (/haute|high/.test(v)) return 'high';
  if (/basse|low/.test(v)) return 'low';
  return 'normal';
}

function mapProductionStatus(
  value?: string,
): (typeof AI_VIDEO_PRODUCTION_STATUSES)[number] {
  const v = (value ?? '').trim().toLowerCase();
  if (/brief|idée|idee/.test(v)) return 'idea';
  if (/tournage planifié|shooting_planned/.test(v)) return 'shooting_planned';
  if (/montage|editing/.test(v)) return 'editing';
  if (/validé|validated/.test(v)) return 'validated';
  return 'idea';
}

/** Parse quick-action structured video template into draft fields. */
export function extractStructuredVideoFields(message: string): AiVideoDraftPayload | null {
  if (!isStructuredVideoTemplate(message)) return null;

  const fields = parseLabeledFieldBlock(message);
  const titleRaw = pickField(fields, ['Titre']);
  const title = titleRaw ? cleanTitleValue(titleRaw) : '';

  if (!title) return null;

  const clientName = pickField(fields, ['Client']);
  const subject = pickField(fields, ['Sujet']);
  const type = pickField(fields, ['Type']);
  const shootingDateText = pickField(fields, ['Tournage']);
  const clientDeliveryDateText = pickField(fields, ['Livraison client', 'Livraison']);
  const editorName = pickField(fields, ['Monteur']);
  const cameramanName = pickField(fields, ['Cadreur']);
  const priority = mapVideoPriority(pickField(fields, ['Priorité', 'Priorite']) ?? 'normale');
  const productionStatus = mapProductionStatus(
    pickField(fields, ['Statut initial', 'Statut']) ?? 'idée / brief',
  );
  const description = pickField(fields, ['Description']);

  const shootingDateIso = shootingDateText
    ? parseFrenchDateText(shootingDateText) ?? undefined
    : undefined;
  const clientDeliveryDateIso = clientDeliveryDateText
    ? parseFrenchDateText(clientDeliveryDateText) ?? undefined
    : undefined;

  return {
    title,
    clientName: clientName ? capitalizeName(clientName) : undefined,
    subject: subject || undefined,
    type: type || undefined,
    shootingDateText: shootingDateText || undefined,
    shootingDateIso,
    clientDeliveryDateText: clientDeliveryDateText || undefined,
    clientDeliveryDateIso,
    editorName: editorName ? capitalizeName(editorName) : undefined,
    cameramanName: cameramanName ? capitalizeName(cameramanName) : undefined,
    priority,
    productionStatus,
    portalStatus: 'topic_proposed',
    description: description || undefined,
  };
}

export function normalizeVideoDraft(
  draft: AiVideoDraftPayload,
  userMessage?: string,
): AiVideoDraftPayload {
  const fromMessage = userMessage?.trim()
    ? extractStructuredVideoFields(userMessage)
    : null;

  if (fromMessage) {
    return {
      ...draft,
      title: fromMessage.title,
      clientName: fromMessage.clientName ?? draft.clientName,
      subject: fromMessage.subject ?? draft.subject,
      type: fromMessage.type ?? draft.type,
      shootingDateText: fromMessage.shootingDateText ?? draft.shootingDateText,
      shootingDateIso: fromMessage.shootingDateIso ?? draft.shootingDateIso,
      clientDeliveryDateText:
        fromMessage.clientDeliveryDateText ?? draft.clientDeliveryDateText,
      clientDeliveryDateIso:
        fromMessage.clientDeliveryDateIso ?? draft.clientDeliveryDateIso,
      editorName: fromMessage.editorName ?? draft.editorName,
      cameramanName: fromMessage.cameramanName ?? draft.cameramanName,
      priority: fromMessage.priority ?? draft.priority ?? 'normal',
      productionStatus: fromMessage.productionStatus ?? draft.productionStatus ?? 'idea',
      portalStatus: draft.portalStatus ?? 'topic_proposed',
      description: fromMessage.description ?? draft.description,
    };
  }

  let title = draft.title?.trim() || 'Nouvelle vidéo';
  title = title.replace(/^(titre|title)\s*:\s*/i, '').trim();
  if (/^(client|sujet|type|tournage|monteur|cadreur)\s*:/i.test(title)) {
    title = 'Nouvelle vidéo';
  }

  return {
    ...draft,
    title: capitalizeFirst(title.slice(0, 160)),
    priority: draft.priority ?? 'normal',
    productionStatus: draft.productionStatus ?? 'idea',
    portalStatus: draft.portalStatus ?? 'topic_proposed',
  };
}
