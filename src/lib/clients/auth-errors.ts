/**
 * Client-facing auth copy. Never mention tables, roles, or internals.
 */

export const CLIENT_HOME_PATH = '/client';
export const CLIENT_LOGIN_PATH = '/client/login';

export const CLIENT_AUTH_ERRORS = {
  invalidCredentials: 'E-mail ou mot de passe incorrect.',
  inactive:
    'Votre accès client est désactivé. Contactez votre interlocuteur.',
  genericAccess: 'Accès client impossible. Contactez votre interlocuteur.',
  staff:
    'Cet espace est réservé aux clients. Utilisez la connexion équipe.',
  sessionExpired: 'Votre session a expiré. Veuillez vous reconnecter.',
  passwordSetupRequired: 'Veuillez d’abord créer votre mot de passe.',
  unavailable: 'Connexion impossible pour le moment. Réessayez plus tard.',
  rateLimited: 'Trop de tentatives. Réessayez dans un instant.',
  missingFields: 'E-mail et mot de passe requis.',
} as const;

export type ClientAuthErrorCode =
  | 'DISABLED'
  | 'ACCESS'
  | 'STAFF'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'SESSION';

export function isClientLoginPath(pathname: string): boolean {
  return pathname === CLIENT_LOGIN_PATH || pathname.startsWith(`${CLIENT_LOGIN_PATH}/`);
}

export function isClientProtectedPath(pathname: string): boolean {
  if (pathname === CLIENT_HOME_PATH) return true;
  if (!pathname.startsWith(`${CLIENT_HOME_PATH}/`)) return false;
  return !isClientLoginPath(pathname);
}

export function isClientAreaPath(pathname: string): boolean {
  return pathname === CLIENT_HOME_PATH || pathname.startsWith(`${CLIENT_HOME_PATH}/`);
}

/** Safe in-app next path after client login. Never leave the client area. */
export function safeClientNextPath(next: string | null | undefined): string {
  if (!next) return CLIENT_HOME_PATH;
  const raw = next.trim();
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) {
    return CLIENT_HOME_PATH;
  }

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return CLIENT_HOME_PATH;
  }

  if (
    decoded.includes('..') ||
    decoded.includes('\\') ||
    decoded.startsWith('//') ||
    decoded.includes('://')
  ) {
    return CLIENT_HOME_PATH;
  }

  const pathname = decoded.split('?')[0] ?? CLIENT_HOME_PATH;
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return CLIENT_HOME_PATH;
  if (isClientLoginPath(pathname)) return CLIENT_HOME_PATH;
  if (isClientProtectedPath(pathname)) return pathname;
  return CLIENT_HOME_PATH;
}

function looksInternalAuthMessage(message: string): boolean {
  return /client_users|employees|supabase|row.level|rls|jwt|permission denied|service.?role|auth\.users/i.test(
    message,
  );
}

export function displayClientLoginError(input: {
  status: number;
  message?: string;
  code?: string;
}): string {
  const code = input.code?.trim();
  if (code === 'DISABLED') return CLIENT_AUTH_ERRORS.inactive;
  if (code === 'STAFF') return CLIENT_AUTH_ERRORS.staff;
  if (code === 'ACCESS') return CLIENT_AUTH_ERRORS.genericAccess;
  if (code === 'RATE_LIMITED') return CLIENT_AUTH_ERRORS.rateLimited;
  if (code === 'UNAVAILABLE' || code === 'SESSION') return CLIENT_AUTH_ERRORS.unavailable;

  const raw = input.message?.trim() ?? '';
  if (raw && !looksInternalAuthMessage(raw)) {
    if (input.status === 401) return CLIENT_AUTH_ERRORS.invalidCredentials;
    return raw;
  }

  if (input.status === 401) return CLIENT_AUTH_ERRORS.invalidCredentials;
  if (input.status === 429) return CLIENT_AUTH_ERRORS.rateLimited;
  return CLIENT_AUTH_ERRORS.unavailable;
}
