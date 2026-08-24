/**
 * Client-area ownership helpers.
 * Identity is always session.clientId from requireClientAuth() — never a URL/query client id.
 */

export type ClientOwnershipResult = 'ok' | 'not_found';

/** UUID v4/RFC4122 — same tightness as parseUuidParam, kept local for unit tests. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isClientResourceUuid(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return UUID_RE.test(value.trim());
}

export function normalizeClientResourceUuid(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return isClientResourceUuid(t) ? t.toLowerCase() : null;
}

/**
 * Fail closed. A mismatch is indistinguishable from absence (no IDOR oracle).
 */
export function assertOwnedByAuthenticatedClient(
  resourceClientId: string | null | undefined,
  sessionClientId: string,
): ClientOwnershipResult {
  if (!sessionClientId || !isClientResourceUuid(sessionClientId)) return 'not_found';
  if (!resourceClientId || !isClientResourceUuid(resourceClientId)) return 'not_found';
  return resourceClientId.toLowerCase() === sessionClientId.toLowerCase() ? 'ok' : 'not_found';
}

export function resolveOwnedResourceId(
  rawRouteId: string | null | undefined,
  resourceClientId: string | null | undefined,
  sessionClientId: string,
): { ok: true; id: string } | { ok: false; reason: 'not_found' } {
  const id = normalizeClientResourceUuid(rawRouteId);
  if (!id) return { ok: false, reason: 'not_found' };
  if (assertOwnedByAuthenticatedClient(resourceClientId, sessionClientId) !== 'ok') {
    return { ok: false, reason: 'not_found' };
  }
  return { ok: true, id };
}
