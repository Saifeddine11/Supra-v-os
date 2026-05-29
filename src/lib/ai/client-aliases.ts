import {
  dedupeAliasMatches,
  normalizeAliasInput,
  normalizeFullName,
  toAliasMatches,
  type AliasMatch,
  type AliasResolveResult,
} from '@/lib/ai/name-normalize';

type MatchedVia = Extract<AliasResolveResult, { status: 'resolved' }>['matchedVia'];

export type AliasClient = { id: string; name: string };

/** Short client names → normalized full-name targets (no UUIDs). */
const CLIENT_ALIAS_TARGETS: Record<string, string[]> = {
  shah: ['shah immobilier'],
  emara: ['emara estates'],
  africa: ['africa beauty'],
  cassi: ['cassi'],
  sbr: ['sculpt body', 'sbr'],
};

function findByNormalizedNames(clients: AliasClient[], targets: string[]): AliasClient[] {
  const out: AliasClient[] = [];
  for (const target of targets) {
    const normalizedTarget = normalizeAliasInput(target);
    out.push(...clients.filter((c) => normalizeFullName(c.name) === normalizedTarget));
  }
  return dedupeAliasMatches(out);
}

function resolveFromCandidates(
  query: string,
  candidates: AliasClient[],
  matchedVia: MatchedVia,
): AliasResolveResult {
  const unique = dedupeAliasMatches(candidates);
  if (unique.length === 1) {
    return {
      status: 'resolved',
      id: unique[0]!.id,
      label: unique[0]!.name,
      query,
      matchedVia,
    };
  }
  if (unique.length > 1) {
    return { status: 'ambiguous', query, matches: toAliasMatches(unique) };
  }
  return { status: 'not_found', query };
}

/**
 * Resolve client nickname / partial name against visible clients.
 */
export function resolveClientAlias(
  inputName: string,
  clients: AliasClient[],
): AliasResolveResult {
  const query = inputName.trim();
  if (!query) return { status: 'none' };

  const normalizedInput = normalizeAliasInput(query);
  if (!normalizedInput) return { status: 'not_found', query };

  const aliasTargets = CLIENT_ALIAS_TARGETS[normalizedInput];
  if (aliasTargets?.length) {
    const aliasHits = findByNormalizedNames(clients, aliasTargets);
    const aliasResult = resolveFromCandidates(query, aliasHits, 'alias');
    if (aliasResult.status !== 'not_found') return aliasResult;
  }

  const exact = clients.filter((c) => normalizeFullName(c.name) === normalizedInput);
  const exactResult = resolveFromCandidates(query, exact, 'exact_full');
  if (exactResult.status !== 'not_found') return exactResult;

  const wordStart = clients.filter((c) => {
    const n = normalizeFullName(c.name);
    return (
      n.startsWith(normalizedInput) ||
      n.split(/\s+/).some((w) => w.startsWith(normalizedInput))
    );
  });
  const startsResult = resolveFromCandidates(query, wordStart, 'starts_with');
  if (startsResult.status !== 'not_found') return startsResult;

  if (normalizedInput.length >= 2) {
    const contains = clients.filter((c) =>
      normalizeFullName(c.name).includes(normalizedInput),
    );
    const containsResult = resolveFromCandidates(query, contains, 'contains');
    if (containsResult.status !== 'not_found') return containsResult;
  }

  if (clients.length === 1 && normalizedInput.length >= 3) {
    const only = clients[0]!;
    if (normalizeFullName(only.name).includes(normalizedInput)) {
      return {
        status: 'resolved',
        id: only.id,
        label: only.name,
        query,
        matchedVia: 'contains',
      };
    }
  }

  return { status: 'not_found', query };
}

export function listClientAliasKeys(): string[] {
  return Object.keys(CLIENT_ALIAS_TARGETS);
}

export type { AliasMatch, AliasResolveResult };
