/**
 * Shared user-facing error mapping.
 * Raw Supabase / PostgREST / network details are never shown to the user —
 * they are logged only in development builds (__DEV__).
 */

export const ERR_LOAD = 'Impossible de charger les données.';
export const ERR_NETWORK = 'Vérifiez votre connexion puis réessayez.';
export const ERR_FORBIDDEN = 'Vous n’avez pas l’autorisation d’accéder à cette section.';
export const ERR_SESSION = 'Session expirée. Veuillez vous reconnecter.';

/** Dev-only log of the raw error (never rendered in the UI). */
export function logDevError(context: string, error: unknown): void {
  if (__DEV__) {
    console.warn(`[${context}]`, error);
  }
}

/**
 * Maps any thrown error to a clean French message.
 * `fallback` lets call sites use a contextual default (e.g. ERR_LOAD).
 */
export function toUserMessage(error: unknown, fallback: string = ERR_LOAD): string {
  const raw =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  const text = raw.toLowerCase();

  if (
    /network request failed|failed to fetch|networkerror|abort|timeout|enotfound|econnrefused/.test(
      text,
    )
  ) {
    return ERR_NETWORK;
  }
  if (/jwt|token|refresh_token|session|401|not authenticated/.test(text)) {
    return ERR_SESSION;
  }
  if (/permission|denied|row-level security|rls|403|forbidden|policy/.test(text)) {
    return ERR_FORBIDDEN;
  }
  return fallback;
}
