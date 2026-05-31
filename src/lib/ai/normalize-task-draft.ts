import type { AiTaskDraftPayload } from '@/lib/ai/task-draft-schema';
import { parseFrenchDeadlineText, parseFrenchDateText } from '@/lib/ai/parse-task-deadline';
import { isPastOperationalDateTime } from '@/lib/dates/validate-future-date';
import { extractStructuredTaskFields } from '@/lib/ai/extract-structured-task-fields';

const DATE_WORDS =
  /\b(demain|aujourd'hui|aujourdhui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i;

const TASK_INTENT_PREFIX =
  /^(?:je\s+souhaite\s+)?(?:crée(?:r)?|créer|creer|ajoute(?:r)?|ajouter|mets(?:tre)?|mettre|nouvelle)\s+(?:une\s+)?tâche(?:\s+urgente|\s+prioritaire)?\s*[:,-]?\s*/i;

const PRIORITY_WORDS: Array<{ pattern: RegExp; value: AiTaskDraftPayload['priority'] }> = [
  { pattern: /\burgent(?:e)?\b/i, value: 'urgent' },
  { pattern: /\bpriorit(?:é|e)\s+haute\b/i, value: 'high' },
  { pattern: /\bhaute\s+priorit(?:é|e)\b/i, value: 'high' },
  { pattern: /\bbasse\s+priorit(?:é|e)\b/i, value: 'low' },
];

const ACTION_VERBS =
  /\b(appeler|préparer|preparer|monter|montage|corriger|envoyer|valider|faire|relancer|contacter|livrer|tourner|filmer)\b/i;

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

function cleanWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function normalizeActionTitle(title: string): string {
  let t = cleanWhitespace(title);
  t = t.replace(/\bvideos?\b/gi, 'vidéos');
  t = t.replace(/\barm\b/gi, 'ARM');
  return capitalizeFirst(t);
}

function extractPriority(text: string): AiTaskDraftPayload['priority'] {
  for (const { pattern, value } of PRIORITY_WORDS) {
    if (pattern.test(text)) return value;
  }
  return 'normal';
}

function extractDeadlineText(text: string): string | undefined {
  const match = text.match(
    /\b(demain(?:\s+[àa]\s*\d{1,2}(?:h|:?\d{0,2})?)?|aujourd'hui(?:\s+[àa]\s*\d{1,2}(?:h|:?\d{0,2})?)?|(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+[àa]\s*\d{1,2}(?:h|:?\d{0,2})?)?)\b/i,
  );
  return match?.[1]?.trim();
}

function isNoiseToken(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (DATE_WORDS.test(value)) return true;
  if (/^(client|le|la|une|un|tâche|tache|les|des|du|de la)$/i.test(v)) return true;
  if (/^en\s+retard$/i.test(v)) return true;
  return false;
}

function extractAssigneeName(text: string): string | undefined {
  const pourClientColon = text.match(
    /^pour\s+([a-zà-ÿ'-]+)\s+client\s+[a-zà-ÿ][\w\s.'-]+?\s*:/i,
  );
  if (pourClientColon?.[1] && !isNoiseToken(pourClientColon[1])) {
    return capitalizeName(pourClientColon[1]);
  }

  const beforeColon = text.match(/^pour\s+([a-zà-ÿ'-]+(?:\s+[a-zà-ÿ'-]+)?)\s*:/i);
  if (beforeColon?.[1] && !isNoiseToken(beforeColon[1])) {
    const name = beforeColon[1].trim();
    if (!/^client\b/i.test(name)) {
      return capitalizeName(name);
    }
  }

  const leadingPour = text.match(/^pour\s+([a-zà-ÿ'-]+)\s+/i);
  if (leadingPour?.[1] && !isNoiseToken(leadingPour[1])) {
    return capitalizeName(leadingPour[1]);
  }

  const assigneA = text.match(/\bassigne(?:r)?\s+(?:à|a)\s+([a-zà-ÿ'-]+(?:\s+[a-zà-ÿ'-]+)?)/i);
  if (assigneA?.[1] && !isNoiseToken(assigneA[1])) {
    return capitalizeName(assigneA[1]);
  }

  const patterns = [
    /\b(?:pour|à|assign(?:ée?|er)?(?:\s+(?:à|a))?|donne(?:r)?\s+(?:à|a))\s+([a-zà-ÿ'-]+(?:\s+[a-zà-ÿ'-]+)?)\s*[,:\-]/i,
    /\b(?:pour|à)\s+([a-zà-ÿ'-]+(?:\s+[a-zà-ÿ'-]+)?)\s+(?=demain|aujourd'hui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d)/i,
    /\b([a-zà-ÿ'-]+)\s+doit\s+(?:faire|préparer|preparer|monter|corriger|appeler)/i,
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    const name = m?.[1]?.trim();
    if (!name || isNoiseToken(name)) continue;
    return capitalizeName(name);
  }
  return undefined;
}

function extractClientName(text: string): string | undefined {
  const patterns = [
    /\bclient\s+([a-zà-ÿ][\w\s.'-]+?)\s*:/i,
    /\bclient\s*:\s*([a-zà-ÿ][\w\s.'-]*)/i,
    /\b(?:pour le client|client|chez)\s+([a-zà-ÿ][\w\s.'-]+?)(?:[.,]|$|\s+(?:avec|avant|demain|aujourd'hui))/i,
    /\bpour le client\s+([a-zà-ÿ][\w\s.'-]+?)\.?$/i,
    /\b(?:vidéo|video)\s+([a-zà-ÿ][\w\s.'-]+?)(?:[.,]|$)/i,
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    const name = m?.[1]?.trim().replace(/\s*[.,]+\s*$/, '');
    if (name && name.length >= 2 && !isNoiseToken(name)) {
      if (/^[A-Z0-9]{2,8}$/.test(name)) continue;
      return capitalizeName(name);
    }
  }
  return undefined;
}

function extractClientFromTitle(title: string): { title: string; clientName?: string } {
  const videoClient = title.match(/^(.+?)\s+(?:vidéo|video|vidéos)\s+([a-zà-ÿ][\w\s.'-]+)$/i);
  if (videoClient?.[1] && videoClient[2]) {
    const clientPart = videoClient[2].trim();
    const looksLikeProjectCode = /^[A-Z0-9]{2,8}$/.test(clientPart);
    if (!looksLikeProjectCode && !isNoiseToken(clientPart)) {
      const action = cleanWhitespace(videoClient[1]);
      return {
        title: normalizeActionTitle(`${action} vidéos`),
        clientName: capitalizeName(clientPart),
      };
    }
  }

  const appelerNamed = title.match(/^appeler\s+(?!le client\b)([a-zà-ÿ][\w\s.'-]+)$/i);
  if (appelerNamed?.[1] && !isNoiseToken(appelerNamed[1])) {
    const name = capitalizeName(appelerNamed[1].trim());
    return {
      title: `Appeler ${name}`,
      clientName: name,
    };
  }

  const appelerClient = title.match(/^appeler\s+(?:le client\s*)?$/i);
  if (appelerClient) {
    return { title: 'Appeler le client' };
  }

  const forClient = title.match(/^(.+?)\s+pour\s+(?:le client\s+)?([a-zà-ÿ][\w\s.'-]+)$/i);
  if (forClient?.[1] && forClient[2] && !isNoiseToken(forClient[2])) {
    return {
      title: normalizeActionTitle(forClient[1].trim()),
      clientName: capitalizeName(forClient[2].trim()),
    };
  }

  return { title: normalizeActionTitle(title) };
}

function stripTitleMetadata(
  title: string,
  meta: {
    assigneeName?: string;
    clientName?: string;
    deadlineText?: string;
  },
): string {
  let t = title.trim();

  t = t.replace(TASK_INTENT_PREFIX, '');
  t = t.replace(/\b(?:urgente?|priorité\s+haute|haute\s+priorité)\b/gi, '');

  if (meta.assigneeName) {
    const escaped = meta.assigneeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(
      new RegExp(`^pour\\s+${escaped}\\s+`, 'i'),
      '',
    );
    t = t.replace(
      new RegExp(`\\b(?:pour|à|assign(?:ée?|er)?(?:\\s+(?:à|a))?)\\s+${escaped}\\b[,:\\-]?`, 'gi'),
      '',
    );
  }

  if (meta.clientName) {
    const escaped = meta.clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`\\bclient\\s*:\\s*${escaped}\\b`, 'gi'), '');
    t = t.replace(
      new RegExp(`\\b(?:pour le client|client|chez|pour)\\s+${escaped}\\b`, 'gi'),
      '',
    );
    t = t.replace(new RegExp(`\\b(?:vidéo|video|vidéos)\\s+${escaped}\\b`, 'gi'), 'vidéos');
  }

  if (meta.deadlineText) {
    const escaped = meta.deadlineText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '');
  }

  t = t
    .replace(/\b(?:pour le client|pour client)\b/gi, '')
    .replace(/\bclient\s*:\s*$/i, '')
    .replace(/\bpour\s+(?:demain|aujourd'hui)\b/gi, '')
    .replace(/\s*[,:\-–—]\s*$/g, '')
    .replace(/\s*[.!?]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalizeActionTitle(t);
}

function extractActionTitleFromBody(body: string): string {
  let text = cleanWhitespace(body);

  const lastColon = text.lastIndexOf(':');
  if (lastColon >= 0) {
    const after = text.slice(lastColon + 1).trim();
    const before = text.slice(0, lastColon).trim();
    if (after.length >= 3 && (ACTION_VERBS.test(after) || after.split(/\s+/).length <= 6)) {
      return after;
    }
    if (!before || DATE_WORDS.test(before) || /^pour\s+/i.test(before)) {
      return after || before;
    }
  }

  return text;
}

/** Heuristic structured fields from a natural-language task request. */
export function extractTaskFieldsFromMessage(message: string): AiTaskDraftPayload {
  const structured = extractStructuredTaskFields(message);
  if (structured) return structured;

  const raw = message.trim();
  let body = raw.replace(TASK_INTENT_PREFIX, '').trim();

  const priority = extractPriority(raw);
  const deadlineText = extractDeadlineText(body);

  let clientName = extractClientName(body);
  const clientColon = body.match(/\bclient\s*:\s*([a-zà-ÿ][\w\s.'-]*)\s*$/i);
  if (clientColon?.[1]) {
    clientName = capitalizeName(clientColon[1].trim());
    body = body.replace(/\bclient\s*:\s*[a-zà-ÿ][\w\s.'-]*\s*$/i, '').trim();
  }

  let assigneeName = extractAssigneeName(body);
  if (assigneeName) {
    body = body.replace(
      new RegExp(`^pour\\s+${assigneeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'),
      '',
    );
  }

  let titleCandidate = extractActionTitleFromBody(body);
  const fromTitle = extractClientFromTitle(titleCandidate);
  titleCandidate = fromTitle.title;
  if (!clientName && fromTitle.clientName) {
    clientName = fromTitle.clientName;
  }

  let title = stripTitleMetadata(titleCandidate, { assigneeName, clientName, deadlineText });
  if (!title || title.length < 2 || /^(pour|client)\b/i.test(title)) {
    title = stripTitleMetadata(body, { assigneeName, clientName, deadlineText });
  }
  if (!title || title.length < 2) {
    title = 'Nouvelle tâche';
  }

  const deadlineIso = deadlineText
    ? parseFrenchDateText(deadlineText) ?? parseFrenchDeadlineText(deadlineText) ?? undefined
    : undefined;

  return {
    title: title.slice(0, 160),
    assigneeName,
    clientName,
    deadlineText,
    deadlineIso,
    priority,
    status: 'todo',
  };
}

/** Normalize model/heuristic draft — never keep metadata inside title. */
export function normalizeTaskDraft(
  draft: AiTaskDraftPayload,
  userMessage?: string,
): AiTaskDraftPayload {
  const fromMessage = userMessage?.trim()
    ? extractTaskFieldsFromMessage(userMessage)
    : null;

  const merged: AiTaskDraftPayload = {
    title: draft.title?.trim() || fromMessage?.title || 'Nouvelle tâche',
    description: draft.description?.trim() || undefined,
    assigneeName: fromMessage?.assigneeName || draft.assigneeName?.trim() || undefined,
    clientName: fromMessage?.clientName || draft.clientName?.trim() || undefined,
    deadlineText: fromMessage?.deadlineText || draft.deadlineText?.trim() || undefined,
    deadlineIso: draft.deadlineIso || fromMessage?.deadlineIso,
    priority: draft.priority ?? fromMessage?.priority ?? 'normal',
    status: draft.status ?? fromMessage?.status ?? 'todo',
  };

  const fromTitleClient = extractClientFromTitle(merged.title);
  merged.title = fromTitleClient.title;
  if (!merged.clientName && fromTitleClient.clientName) {
    merged.clientName = fromTitleClient.clientName;
  }

  merged.title = stripTitleMetadata(merged.title, {
    assigneeName: merged.assigneeName,
    clientName: merged.clientName,
    deadlineText: merged.deadlineText,
  });

  if (
    fromMessage &&
    (merged.title.length > 60 ||
      /\bpour\b|\bclient\b/i.test(merged.title) ||
      merged.title.toLowerCase() === draft.title?.trim().toLowerCase())
  ) {
    merged.title = fromMessage.title;
    merged.assigneeName = merged.assigneeName || fromMessage.assigneeName;
    merged.clientName = merged.clientName || fromMessage.clientName;
    merged.deadlineText = merged.deadlineText || fromMessage.deadlineText;
    merged.deadlineIso = merged.deadlineIso || fromMessage.deadlineIso;
  }

  if (!merged.title || merged.title.length < 2) {
    merged.title = fromMessage?.title ?? 'Nouvelle tâche';
  }

  if (!merged.deadlineIso && merged.deadlineText) {
    merged.deadlineIso =
      parseFrenchDateText(merged.deadlineText) ??
      parseFrenchDeadlineText(merged.deadlineText) ??
      fromMessage?.deadlineIso;
  }

  if (merged.deadlineIso && isPastOperationalDateTime(merged.deadlineIso)) {
    merged.deadlineIso = undefined;
  }

  merged.title = normalizeActionTitle(merged.title.slice(0, 160));
  return merged;
}

export function extractTaskDraftFromUserMessage(message: string): AiTaskDraftPayload | null {
  const text = message.trim();
  if (!text) return null;
  return extractTaskFieldsFromMessage(text);
}
