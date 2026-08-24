import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AUTH_SET_PASSWORD_PATH } from '@/lib/auth/password-setup';
import { isMissingClientUsersTable } from '@/lib/clients/auth-provision';
import { decideClientAccess } from '@/lib/clients/access-decision';
import { CLIENT_LOGIN_PATH } from '@/lib/clients/auth-errors';

export type ClientAuthContext = {
  authUserId: string;
  clientUserId: string;
  clientId: string;
  fullName: string | null;
  email: string;
  clientName: string | null;
  mustChangePassword: boolean;
};

export type ClientAuthState =
  | { kind: 'unauthenticated' }
  | { kind: 'ok'; ctx: ClientAuthContext }
  | { kind: 'inactive' }
  | { kind: 'missing'; isStaff: boolean }
  | { kind: 'error' };

type ClientUserLookupRow = {
  id: string;
  user_id: string;
  client_id: string;
  full_name: string | null;
  email: string;
  is_active: boolean;
  must_change_password: boolean;
};

/**
 * Resolve the current request's client-area identity.
 * Uses the Auth session, then a server-only admin lookup of client_users by user_id.
 * Clients cannot SELECT client_users under RLS (staff-only policies).
 */
export const getClientAuthState = cache(async (): Promise<ClientAuthState> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: 'unauthenticated' };

  try {
    const admin = createAdminClient();
    const [clientUserRes, employeeRes] = await Promise.all([
      admin
        .from('client_users')
        .select('id, user_id, client_id, full_name, email, is_active, must_change_password')
        .eq('user_id', user.id)
        .maybeSingle(),
      admin.from('employees').select('id').eq('user_id', user.id).maybeSingle(),
    ]);

    if (clientUserRes.error) {
      if (isMissingClientUsersTable(clientUserRes.error)) {
        console.error('[client-auth] client_users table missing');
      } else {
        console.error('[client-auth] client_users lookup failed', clientUserRes.error.message);
      }
      return { kind: 'error' };
    }

    const row = (clientUserRes.data ?? null) as ClientUserLookupRow | null;
    const isStaff = Boolean(employeeRes.data);

    let clientExists = true;
    let clientName: string | null = null;
    if (row) {
      const { data: client, error: clientError } = await admin
        .from('clients')
        .select('id, name')
        .eq('id', row.client_id)
        .maybeSingle();
      if (clientError) {
        console.error('[client-auth] clients lookup failed', clientError.message);
        return { kind: 'error' };
      }
      clientExists = Boolean(client);
      clientName = typeof client?.name === 'string' ? client.name : null;
    }

    const decision = decideClientAccess({
      hasAuthUser: true,
      clientUser: row
        ? {
            is_active: row.is_active,
            must_change_password: row.must_change_password,
            client_id: row.client_id,
          }
        : null,
      clientExists,
      isStaff,
    });

    if (decision.status === 'allow') {
      return {
        kind: 'ok',
        ctx: {
          authUserId: user.id,
          clientUserId: row!.id,
          clientId: row!.client_id,
          fullName: row!.full_name,
          email: row!.email,
          clientName,
          mustChangePassword: decision.mustChangePassword,
        },
      };
    }
    if (decision.status === 'inactive') return { kind: 'inactive' };
    if (decision.status === 'staff') return { kind: 'missing', isStaff: true };
    return { kind: 'missing', isStaff: false };
  } catch (e) {
    console.error('[client-auth] unexpected lookup error', e instanceof Error ? e.message : e);
    return { kind: 'error' };
  }
});

export const getClientAuthContext = cache(async (): Promise<ClientAuthContext | null> => {
  const state = await getClientAuthState();
  return state.kind === 'ok' ? state.ctx : null;
});

async function signOutCurrentSession(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (e) {
    console.error('[client-auth] signOut failed', e instanceof Error ? e.message : e);
  }
}

/**
 * Server-side gate for authenticated client routes.
 * Inactive / orphan sessions are cleared via the logout route so cookies are actually dropped.
 */
export async function requireClientAuth(): Promise<ClientAuthContext> {
  const state = await getClientAuthState();

  if (state.kind === 'unauthenticated') {
    redirect(CLIENT_LOGIN_PATH);
  }
  if (state.kind === 'inactive') {
    redirect('/api/auth/client-logout?error=disabled');
  }
  if (state.kind === 'error') {
    redirect(`${CLIENT_LOGIN_PATH}?error=unavailable`);
  }
  if (state.kind === 'missing') {
    if (state.isStaff) {
      redirect('/login');
    }
    redirect('/api/auth/client-logout?error=access');
  }
  if (state.ctx.mustChangePassword) {
    redirect(AUTH_SET_PASSWORD_PATH);
  }
  return state.ctx;
}

/** Best-effort last_login_at — never blocks a successful login. */
export async function touchClientLastLogin(clientUserId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('client_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', clientUserId);
    if (error) {
      console.error('[client-auth] last_login_at update failed', error.message);
    }
  } catch (e) {
    console.error('[client-auth] last_login_at update failed', e instanceof Error ? e.message : e);
  }
}

export { signOutCurrentSession };
