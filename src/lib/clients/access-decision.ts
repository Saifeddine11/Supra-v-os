/**
 * Pure client-area access rules. Source of truth after Auth:
 * auth.users.id → client_users.user_id. Never use employees for client access.
 */

export type ClientAccessDecision =
  | { status: 'unauthenticated' }
  | { status: 'staff' }
  | { status: 'missing' }
  | { status: 'inactive' }
  | { status: 'allow'; mustChangePassword: boolean };

export type ClientAccessRow = {
  is_active: boolean;
  must_change_password: boolean;
  client_id: string;
};

/**
 * Evaluate whether an Auth user may enter the authenticated client area.
 * Dual-role is rejected (staff wins) — the schema forbids it, this is defense in depth.
 */
export function decideClientAccess(input: {
  hasAuthUser: boolean;
  clientUser: ClientAccessRow | null;
  clientExists: boolean;
  isStaff: boolean;
}): ClientAccessDecision {
  if (!input.hasAuthUser) return { status: 'unauthenticated' };
  // Staff Auth users must never enter the client area, even if a row existed.
  if (input.isStaff) return { status: 'staff' };
  if (!input.clientUser) return { status: 'missing' };
  if (!input.clientUser.is_active) return { status: 'inactive' };
  if (!input.clientExists) return { status: 'missing' };
  return {
    status: 'allow',
    mustChangePassword: input.clientUser.must_change_password === true,
  };
}
