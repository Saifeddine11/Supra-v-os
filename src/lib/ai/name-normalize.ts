/**
 * Shared normalization for SupAI alias resolution (employees, clients).
 */
export function normalizeAliasInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeFullName(value: string): string {
  return normalizeAliasInput(value);
}

export function firstToken(normalizedFullName: string): string {
  return normalizedFullName.split(/\s+/)[0] ?? '';
}

export type AliasMatch = { id: string; label: string };

export type AliasResolveResult =
  | { status: 'none' }
  | {
      status: 'resolved';
      id: string;
      label: string;
      query: string;
      matchedVia: 'alias' | 'exact_full' | 'exact_first' | 'starts_with' | 'contains';
    }
  | { status: 'not_found'; query: string }
  | { status: 'ambiguous'; query: string; matches: AliasMatch[] };

export function dedupeAliasMatches<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function toAliasMatches<T extends { id: string; full_name?: string; name?: string }>(
  items: T[],
): AliasMatch[] {
  return items.map((item) => ({
    id: item.id,
    label: String(item.full_name ?? item.name ?? item.id),
  }));
}
