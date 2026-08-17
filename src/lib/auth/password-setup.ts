/**
 * Invite / recovery password setup — public routes and URL helpers.
 * Keep this module Edge-safe (used by middleware).
 */

export const AUTH_SET_PASSWORD_PATH = '/auth/set-password';
export const AUTH_CONFIRM_PATH = '/auth/confirm';
export const AUTH_CALLBACK_PATH = '/auth/callback';

export const PASSWORD_SETUP_MIN_LENGTH = 8;

const PASSWORD_SETUP_TYPES = new Set(['invite', 'recovery']);

export function getAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

/** redirectTo for inviteUserByEmail / resetPasswordForEmail — no query string (allowlist-safe). */
export function getAuthSetPasswordRedirectUrl(): string {
  return `${getAppOrigin()}${AUTH_SET_PASSWORD_PATH}`;
}

export function isPasswordSetupType(value: string | null | undefined): boolean {
  return Boolean(value && PASSWORD_SETUP_TYPES.has(value));
}

/** Query params that mean this request is an invite/recovery callback, not a normal visit. */
export function hasPasswordSetupSearchParams(searchParams: {
  get(name: string): string | null;
  has(name: string): boolean;
}): boolean {
  if (searchParams.has('code') || searchParams.has('token_hash')) return true;
  return isPasswordSetupType(searchParams.get('type'));
}

/** Client-side: hash fragments are never sent to the server. */
export function isPasswordSetupLocation(search: string, hash: string): boolean {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(query);
  const hashParams = new URLSearchParams(fragment);
  return (
    hasPasswordSetupSearchParams(params) ||
    hashParams.has('access_token') ||
    hashParams.has('refresh_token') ||
    isPasswordSetupType(hashParams.get('type'))
  );
}
