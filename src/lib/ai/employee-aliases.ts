import {
  dedupeAliasMatches,
  firstToken,
  normalizeAliasInput,
  normalizeFullName,
  toAliasMatches,
  type AliasMatch,
  type AliasResolveResult,
} from '@/lib/ai/name-normalize';

type MatchedVia = Extract<AliasResolveResult, { status: 'resolved' }>['matchedVia'];

export type AliasEmployee = { id: string; full_name: string };

/** Nickname / partial name → normalized full-name targets (no UUIDs). */
const EMPLOYEE_ALIAS_TARGETS: Record<string, string[]> = {
  jul: ['julien'],
  ju: ['julien'],
  julien: ['julien'],
  mounir: ['mounir boutayeb'],
  mymy: ['meryem halli'],
  mimi: ['meryem halli'],
  meryem: ['meryem halli'],
  cleis: ['cleis padou'],
  saif: ['saif eddine'],
  seif: ['saif eddine'],
};

function findByNormalizedNames(
  employees: AliasEmployee[],
  targets: string[],
): AliasEmployee[] {
  const out: AliasEmployee[] = [];
  for (const target of targets) {
    const normalizedTarget = normalizeAliasInput(target);
    out.push(
      ...employees.filter((e) => normalizeFullName(e.full_name) === normalizedTarget),
    );
  }
  return dedupeAliasMatches(out);
}

function resolveFromCandidates(
  query: string,
  candidates: AliasEmployee[],
  matchedVia: MatchedVia,
): AliasResolveResult {
  const unique = dedupeAliasMatches(candidates);
  if (unique.length === 1) {
    return {
      status: 'resolved',
      id: unique[0]!.id,
      label: unique[0]!.full_name,
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
 * Resolve employee nickname / partial name against visible active employees.
 * Order: alias map → exact full name → exact first name → starts-with → contains.
 */
export function resolveEmployeeAlias(
  inputName: string,
  employees: AliasEmployee[],
): AliasResolveResult {
  const query = inputName.trim();
  if (!query) return { status: 'none' };

  const normalizedInput = normalizeAliasInput(query);
  if (!normalizedInput) return { status: 'not_found', query };

  const aliasTargets = EMPLOYEE_ALIAS_TARGETS[normalizedInput];
  if (aliasTargets?.length) {
    const aliasHits = findByNormalizedNames(employees, aliasTargets);
    const aliasResult = resolveFromCandidates(query, aliasHits, 'alias');
    if (aliasResult.status !== 'not_found') return aliasResult;
  }

  const exactFull = employees.filter(
    (e) => normalizeFullName(e.full_name) === normalizedInput,
  );
  const exactFullResult = resolveFromCandidates(query, exactFull, 'exact_full');
  if (exactFullResult.status !== 'not_found') return exactFullResult;

  const exactFirst = employees.filter(
    (e) => firstToken(normalizeFullName(e.full_name)) === normalizedInput,
  );
  const exactFirstResult = resolveFromCandidates(query, exactFirst, 'exact_first');
  if (exactFirstResult.status !== 'not_found') return exactFirstResult;

  const startsWith = employees.filter((e) => {
    const full = normalizeFullName(e.full_name);
    const first = firstToken(full);
    return first.startsWith(normalizedInput) || full.startsWith(normalizedInput);
  });
  const startsResult = resolveFromCandidates(query, startsWith, 'starts_with');
  if (startsResult.status !== 'not_found') return startsResult;

  if (normalizedInput.length >= 2) {
    const contains = employees.filter((e) =>
      normalizeFullName(e.full_name).includes(normalizedInput),
    );
    const containsResult = resolveFromCandidates(query, contains, 'contains');
    if (containsResult.status !== 'not_found') return containsResult;
  }

  return { status: 'not_found', query };
}

export function listEmployeeAliasKeys(): string[] {
  return Object.keys(EMPLOYEE_ALIAS_TARGETS);
}

export type { AliasMatch, AliasResolveResult };
