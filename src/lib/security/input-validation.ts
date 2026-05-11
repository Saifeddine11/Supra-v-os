/**
 * Validation d’entrées pour éviter injection PostgREST / filtres mal formés.
 * Les requêtes Supabase passent par l’API HTTP : ce n’est pas du SQL brut côté client,
 * mais des valeurs non contrôlées dans `.or()`, `.eq()` sur UUID, etc. peuvent casser
 * le filtre ou provoquer des erreurs / comportements imprévisibles.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Retourne true si la chaîne est un UUID v4 (ou autre variante RFC4122) strict. */
export function isUuid(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return UUID_RE.test(value.trim());
}

/** Retourne l’UUID normalisé ou `null` si invalide. */
export function parseUuidParam(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return isUuid(t) ? t.toLowerCase() : null;
}

/** Limite la longueur des chaînes de recherche (UI / abuse). */
export function clampSearchInput(raw: string | null | undefined, maxLen = 200): string {
  if (raw == null) return '';
  return raw.trim().slice(0, maxLen);
}

/**
 * Échappe `%` et `_` pour une utilisation dans un motif `ilike` / `like`,
 * afin d’éviter que l’utilisateur élargisse arbitrairement le motif.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Retourne `value` si elle est dans `allowed`, sinon `fallback`. */
export function parseEnumParam<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  if (value == null || value === '') return fallback;
  const v = value.trim() as T;
  return (allowed as readonly string[]).includes(v) ? v : fallback;
}

/** Accepte dates `YYYY-MM-DD` ou ISO timestamptz basique pour filtres `.gte` / `.lte`. */
export function parseSafeIsoDate(raw: string | null | undefined): string | undefined {
  if (raw == null) return undefined;
  const t = raw.trim();
  if (t.length > 40) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(t)) return undefined;
  return t;
}
