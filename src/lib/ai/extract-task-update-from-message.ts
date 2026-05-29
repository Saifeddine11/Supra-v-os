import type { AiTaskUpdateChanges, AiTaskUpdateDraftPayload } from '@/lib/ai/task-update-draft-schema';
import {
  isStructuredTaskUpdateTemplate,
  parseLabeledFieldBlock,
  pickField,
} from '@/lib/ai/parse-structured-template';
import { parseFrenchTaskPriority, parseFrenchTaskStatus } from '@/lib/ai/normalize-task-update-draft';
import { parseFrenchDateText } from '@/lib/ai/parse-task-deadline';

function extractTaskSearchText(message: string): string | undefined {
  const patterns = [
    /(?:modifie|modifier|mets?\s+(?:à|a)\s+jour|mettre\s+(?:à|a)\s+jour|change|changer)\s+(?:la\s+)?t[âa]che\s+(.+?)(?:\s+et\s+|\s*,\s*|\s+(?:mets|met|change|assigne|assigner|avec)|$)/i,
    /(?:t[âa]che\s+)(["«][^"»]+["»]|[^\n,.;]+?)(?:\s+et\s+|\s*,|\s+(?:mets|met|change|assigne)|$)/i,
    /(?:titre\s+de\s+(?:la\s+)?t[âa]che\s+)(["«][^"»]+["»]|[^\n,.;]+)/i,
  ];

  for (const p of patterns) {
    const m = p.exec(message);
    const raw = m?.[1]?.trim().replace(/^["«]|["»]$/g, '');
    if (raw && raw.length >= 2) {
      return raw
        .replace(/\s+(?:et|puis)\s+.+$/i, '')
        .replace(/\s+(?:mets|met|change|assigne).+$/i, '')
        .trim();
    }
  }
  return undefined;
}

function extractTitleChange(message: string): string | undefined {
  const patterns = [
    /(?:change|changer|modifie|modifier)\s+(?:le\s+)?titre\s+(?:de\s+(?:la\s+)?t[âa]che\s+)?(?:.+?\s+)?(?:en|par|pour|à|a)\s+(.+)/i,
    /(?:nouveau\s+titre\s*:\s*)(.+)/i,
  ];
  for (const p of patterns) {
    const m = p.exec(message);
    const val = m?.[1]?.trim().replace(/^["«]|["»]$/g, '');
    if (val) return val.split(/\n/)[0]?.trim();
  }
  return undefined;
}

function extractDeadlineText(message: string): string | undefined {
  const patterns = [
    /(?:échéance|echeance|deadline)\s*(?:à|a|:)?\s*(.+?)(?:\s*$|\s*\.|\s*,|\s+et\s+)/i,
    /(?:mets?\s+(?:l[''])?échéance|met(?:tre)?\s+(?:l[''])?échéance)\s+(?:à|a|pour|au)?\s*(.+?)(?:\s*$|\s*\.|\s*,|\s+et\s+)/i,
    /(?:pour\s+)(demain(?:\s+(?:à|a)\s*\d{1,2}h(?:\d{2})?)?|aujourd'hui(?:\s+(?:à|a)\s*\d{1,2}h(?:\d{2})?)?|vendredi(?:\s+(?:à|a)\s*\d{1,2}h(?:\d{2})?)?|lundi|mardi|mercredi|jeudi|samedi|dimanche(?:\s+(?:à|a)\s*\d{1,2}h(?:\d{2})?)?|le\s+\d{1,2}\s+\w+)/i,
  ];
  for (const p of patterns) {
    const m = p.exec(message);
    const val = m?.[1]?.trim();
    if (val) return val;
  }
  return undefined;
}

function extractAssigneeName(message: string): string | undefined {
  const m =
    /(?:assigne(?:r)?\s+(?:à|a)|assign[ée]\s+(?:à|a)|pour\s+)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]{1,40})/i.exec(
      message,
    );
  return m?.[1]?.trim();
}

function extractClientName(message: string): string | undefined {
  const m =
    /(?:mets?\s+(?:le\s+)?client|client)\s+(["«][^"»]+["»]|[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s.&'-]{1,80})/i.exec(
      message,
    );
  const val = m?.[1]?.trim().replace(/^["«]|["»]$/g, '');
  return val?.split(/\n/)[0]?.trim();
}

function extractStatusFromMessage(message: string): AiTaskUpdateChanges['status'] | undefined {
  const m = /(?:mets?\s+(?:la\s+)?t[âa]che\s+.+?\s+en\s+)([a-zàâäéèêëïîôùûüç\s'-]+)/i.exec(message);
  if (m?.[1]) {
    const parsed = parseFrenchTaskStatus(m[1]);
    if (parsed) return parsed;
  }
  if (/\ben\s+cours\b/i.test(message)) return 'in_progress';
  if (/\b(?:à|a)\s+faire\b/i.test(message)) return 'todo';
  return parseFrenchTaskStatus(message);
}

function fromStructuredTemplate(message: string): AiTaskUpdateDraftPayload | null {
  const fields = parseLabeledFieldBlock(message);
  const taskSearchText = pickField(fields, ['Tâche à modifier', 'Tache a modifier', 'Tâche', 'Tache']);
  const title = pickField(fields, ['Nouveau titre', 'Titre']);
  const clientName = pickField(fields, ['Client']);
  const assignee = pickField(fields, ['Assigné(s)', 'Assigne(s)', 'Assigné', 'Assigne']);
  const deadlineText = pickField(fields, ['Échéance', 'Echeance', 'Deadline']);
  const priorityRaw = pickField(fields, ['Priorité', 'Priorite']);
  const statusRaw = pickField(fields, ['Statut', 'Status']);
  const description = pickField(fields, ['Description']);

  if (!taskSearchText && !title && !deadlineText && !statusRaw && !clientName && !assignee) {
    return null;
  }

  const changes: AiTaskUpdateChanges = {};
  if (title) changes.title = title;
  if (description) changes.description = description;
  if (clientName) changes.clientName = clientName;
  if (assignee) changes.assigneeName = assignee;
  if (deadlineText) {
    changes.deadlineText = deadlineText;
    const iso = parseFrenchDateText(deadlineText);
    if (iso) changes.deadlineIso = iso;
  }
  if (priorityRaw) {
    const p = parseFrenchTaskPriority(priorityRaw);
    if (p) changes.priority = p;
  }
  if (statusRaw) {
    const s = parseFrenchTaskStatus(statusRaw);
    if (s) changes.status = s;
  }

  return {
    taskSearchText: taskSearchText || undefined,
    changes,
  };
}

export function extractTaskUpdateFromUserMessage(message: string): AiTaskUpdateDraftPayload | null {
  const text = message.trim();
  if (!text) return null;

  if (isStructuredTaskUpdateTemplate(text)) {
    return fromStructuredTemplate(text);
  }

  const changes: AiTaskUpdateChanges = {};
  const taskSearchText = extractTaskSearchText(text);
  const title = extractTitleChange(text);
  const deadlineText = extractDeadlineText(text);
  const assigneeName = extractAssigneeName(text);
  const clientName = extractClientName(text);
  const status = extractStatusFromMessage(text);

  if (title) changes.title = title;
  if (deadlineText) {
    changes.deadlineText = deadlineText;
    const iso = parseFrenchDateText(deadlineText);
    if (iso) changes.deadlineIso = iso;
  }
  if (assigneeName) changes.assigneeName = assigneeName;
  if (clientName) changes.clientName = clientName;
  if (status) changes.status = status;

  if (
    /\b(retire|retirer|supprime|supprimer|enl[èe]ve|pas d['']?échéance|sans échéance)\b/i.test(text) &&
    /échéance|echeance|deadline/i.test(text)
  ) {
    changes.clearDeadline = true;
  }

  if (!taskSearchText && !Object.keys(changes).length) {
    return null;
  }

  return {
    taskSearchText,
    changes,
  };
}
