import type { AiTaskDraftPayload } from '@/lib/ai/task-draft-schema';
import { parseFrenchDateText } from '@/lib/ai/parse-task-deadline';
import {
  isStructuredTaskTemplate,
  parseLabeledFieldBlock,
  pickField,
} from '@/lib/ai/parse-structured-template';

function mapTaskPriority(value?: string): AiTaskDraftPayload['priority'] {
  const v = (value ?? '').trim().toLowerCase();
  if (/urgent/.test(v)) return 'urgent';
  if (/haute|high/.test(v)) return 'high';
  if (/basse|low/.test(v)) return 'low';
  return 'normal';
}

function mapTaskStatus(value?: string): AiTaskDraftPayload['status'] {
  const v = (value ?? '').trim().toLowerCase();
  if (/en cours|in_progress|progress/.test(v)) return 'in_progress';
  return 'todo';
}

function capitalizeName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function cleanTitleValue(value: string): string {
  return value
    .replace(/^(titre|title)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

/** Parse quick-action structured task template into draft fields. */
export function extractStructuredTaskFields(message: string): AiTaskDraftPayload | null {
  if (!isStructuredTaskTemplate(message)) return null;

  const fields = parseLabeledFieldBlock(message);
  const titleRaw = pickField(fields, ['Titre']);
  const title = titleRaw ? cleanTitleValue(titleRaw) : '';

  if (!title) {
    return null;
  }

  const clientName = pickField(fields, ['Client']);
  const assigneeRaw = pickField(fields, ['Assigné(s)', 'Assigné', 'Assignés']);
  const assigneeName = assigneeRaw
    ? capitalizeName(assigneeRaw.split(/[,;]/)[0]?.trim() ?? assigneeRaw)
    : undefined;
  const linkedVideoName = pickField(fields, ['Vidéo liée', 'Video liée']);
  const deadlineText = pickField(fields, ['Échéance', 'Echeance']);
  const priority = mapTaskPriority(pickField(fields, ['Priorité', 'Priorite']) ?? 'normale');
  const status = mapTaskStatus(pickField(fields, ['Statut']) ?? 'à faire');
  let description = pickField(fields, ['Description']);

  if (linkedVideoName) {
    const note = `Vidéo liée : ${linkedVideoName}`;
    description = description ? `${note}\n\n${description}` : note;
  }

  const deadlineIso = deadlineText ? parseFrenchDateText(deadlineText) ?? undefined : undefined;

  return {
    title,
    description: description || undefined,
    clientName: clientName ? capitalizeName(clientName) : undefined,
    assigneeName,
    deadlineText: deadlineText || undefined,
    deadlineIso,
    priority,
    status,
  };
}
