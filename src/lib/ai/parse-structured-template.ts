/**
 * Parse labeled field blocks from SupAI quick-action templates.
 * Format: "Label : value" per line, optional "Instructions :" footer ignored.
 */

export type ParsedLabeledFields = Record<string, string>;

const INSTRUCTIONS_SPLIT = /\nInstructions\s*:/i;

function normalizeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
}

/** Extract "Label : value" pairs from a structured template body. */
export function parseLabeledFieldBlock(message: string): ParsedLabeledFields {
  const body = message.split(INSTRUCTIONS_SPLIT)[0] ?? message;
  const out: ParsedLabeledFields = {};

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(.+?)\s*:\s*(.*)$/);
    if (!match) continue;

    const label = match[1].trim();
    const value = match[2].trim();

    if (/^je souhaite\b/i.test(label)) continue;
    if (/^informations suivantes$/i.test(label)) continue;

    const key = normalizeLabel(label);
    if (!key) continue;

    if (out[key] !== undefined && !out[key] && value) {
      out[key] = value;
    } else if (out[key] === undefined) {
      out[key] = value;
    }
  }

  return out;
}

export function pickField(
  fields: ParsedLabeledFields,
  aliases: string[],
): string | undefined {
  for (const alias of aliases) {
    const key = normalizeLabel(alias);
    const value = fields[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function isStructuredTaskTemplate(message: string): boolean {
  return /je\s+souhaite\s+cr[ée]er\s+une\s+t[âa]che\s+avec\s+les\s+informations\s+suivantes/i.test(
    message,
  );
}

export function isStructuredVideoTemplate(message: string): boolean {
  return /je\s+souhaite\s+cr[ée]er\s+une\s+vid[ée]o\s+avec\s+les\s+informations\s+suivantes/i.test(
    message,
  );
}

export function isStructuredMessageTemplate(message: string): boolean {
  return /je\s+souhaite\s+r[ée]diger\s+un\s+message\s+avec\s+les\s+informations\s+suivantes/i.test(
    message,
  );
}

export function isStructuredTaskUpdateTemplate(message: string): boolean {
  return /je\s+souhaite\s+modifier\s+une\s+t[âa]che\s+avec\s+les\s+informations\s+suivantes/i.test(
    message,
  );
}

/** Cursor position after "Label :" for textarea focus (same line, before any prefilled value). */
export function getTemplateCursorPosition(template: string, afterLabel?: string): number {
  if (!afterLabel) return template.length;

  const escaped = afterLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linePattern = new RegExp(
    `^\\s*${escaped}(?:\\([^)]*\\))?\\s*:[ \\t]*(.*)$`,
    'im',
  );
  const match = linePattern.exec(template);
  if (match) {
    const valueLen = match[1]?.length ?? 0;
    return match.index + match[0].length - valueLen;
  }
  return template.length;
}
