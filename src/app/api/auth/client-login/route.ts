/**
 * POST /api/auth/client-login
 * --------------------------------------------------------------------------
 * Server-side client sign-in (browser calls same-origin /api only).
 * Auth uses the anon key + cookies. client_users is loaded with the
 * server-only service-role client because RLS is staff-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIpFrom, rateLimit } from '@/lib/security/rate-limit';
import { isMissingClientUsersTable } from '@/lib/clients/auth-provision';
import { decideClientAccess } from '@/lib/clients/access-decision';
import { CLIENT_AUTH_ERRORS } from '@/lib/clients/auth-errors';
import { touchClientLastLogin } from '@/lib/clients/session';

function mapAuthMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return CLIENT_AUTH_ERRORS.invalidCredentials;
  }
  if (/email not confirmed/i.test(message)) {
    return 'Veuillez confirmer votre adresse e-mail avant de vous connecter.';
  }
  return CLIENT_AUTH_ERRORS.invalidCredentials;
}

function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json({ error, code }, { status });
}

function applySessionCookies(
  res: NextResponse,
  cookies: { name: string; value: string; options: CookieOptions }[],
) {
  cookies.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, options);
  });
  return res;
}

/**
 * Auth succeeded but client access is denied. Revoke the just-created session
 * and persist the resulting Set-Cookie headers so no usable app session remains.
 */
async function denyAfterSignIn(
  supabase: ReturnType<typeof createServerClient<Database>>,
  sessionCookies: { name: string; value: string; options: CookieOptions }[],
  error: string,
  status: number,
  code?: string,
) {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error('[auth/client-login] signOut after reject', e instanceof Error ? e.message : e);
  }
  return applySessionCookies(jsonError(error, status, code), sessionCookies);
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Méthode non autorisée. Utilisez POST avec JSON { "email", "password" }.',
      allow: ['POST'],
    },
    { status: 405, headers: { Allow: 'POST' } },
  );
}

export async function POST(request: NextRequest) {
  const ip = clientIpFrom(request);
  const rl = rateLimit({ key: `client-login:${ip}`, max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return jsonError(CLIENT_AUTH_ERRORS.rateLimited, 429, 'RATE_LIMITED');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Requête invalide.', 400);
  }

  const email =
    typeof body === 'object' &&
    body !== null &&
    'email' in body &&
    typeof (body as { email: unknown }).email === 'string'
      ? (body as { email: string }).email.trim()
      : '';
  const password =
    typeof body === 'object' &&
    body !== null &&
    'password' in body &&
    typeof (body as { password: unknown }).password === 'string'
      ? (body as { password: string }).password
      : '';

  if (!email || !password) {
    return jsonError(CLIENT_AUTH_ERRORS.missingFields, 400);
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !rawAnon) {
    console.error('[auth/client-login] missing public Supabase env');
    return jsonError(CLIENT_AUTH_ERRORS.unavailable, 500, 'UNAVAILABLE');
  }

  const url = normalizeSupabaseProjectUrl(rawUrl);
  const sessionCookies: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient<Database>(url, rawAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        sessionCookies.push(...cookiesToSet);
      },
    },
  });

  try {
    const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signError) {
      console.warn('[auth/client-login] signIn error:', signError.code || 'unknown');
      return jsonError(mapAuthMessage(signError.message), 401);
    }

    const user = signData.user;
    if (!user) {
      console.error('[auth/client-login] no user after signIn');
      return denyAfterSignIn(
        supabase,
        sessionCookies,
        CLIENT_AUTH_ERRORS.unavailable,
        500,
        'UNAVAILABLE',
      );
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch (e) {
      console.error('[auth/client-login] admin client', e instanceof Error ? e.message : e);
      return denyAfterSignIn(
        supabase,
        sessionCookies,
        CLIENT_AUTH_ERRORS.unavailable,
        500,
        'UNAVAILABLE',
      );
    }

    const [clientUserRes, employeeRes] = await Promise.all([
      admin
        .from('client_users')
        .select('id, user_id, client_id, is_active, must_change_password')
        .eq('user_id', user.id)
        .maybeSingle(),
      admin.from('employees').select('id').eq('user_id', user.id).maybeSingle(),
    ]);

    if (clientUserRes.error) {
      if (isMissingClientUsersTable(clientUserRes.error)) {
        console.error('[auth/client-login] client_users table missing');
      } else {
        console.error('[auth/client-login] client_users lookup', clientUserRes.error.message);
      }
      return denyAfterSignIn(
        supabase,
        sessionCookies,
        CLIENT_AUTH_ERRORS.unavailable,
        500,
        'UNAVAILABLE',
      );
    }

    const row = clientUserRes.data as {
      id: string;
      user_id: string;
      client_id: string;
      is_active: boolean;
      must_change_password: boolean;
    } | null;

    let clientExists = false;
    if (row) {
      const { data: client, error: clientError } = await admin
        .from('clients')
        .select('id')
        .eq('id', row.client_id)
        .maybeSingle();
      if (clientError) {
        console.error('[auth/client-login] clients lookup', clientError.message);
        return denyAfterSignIn(
          supabase,
          sessionCookies,
          CLIENT_AUTH_ERRORS.unavailable,
          500,
          'UNAVAILABLE',
        );
      }
      clientExists = Boolean(client);
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
      isStaff: Boolean(employeeRes.data),
    });

    if (decision.status !== 'allow') {
      if (decision.status === 'inactive') {
        return denyAfterSignIn(
          supabase,
          sessionCookies,
          CLIENT_AUTH_ERRORS.inactive,
          403,
          'DISABLED',
        );
      }
      if (decision.status === 'staff') {
        return denyAfterSignIn(supabase, sessionCookies, CLIENT_AUTH_ERRORS.staff, 403, 'STAFF');
      }
      return denyAfterSignIn(
        supabase,
        sessionCookies,
        CLIENT_AUTH_ERRORS.genericAccess,
        403,
        'ACCESS',
      );
    }

    await touchClientLastLogin(row!.id);

    const res = NextResponse.json({
      ok: true as const,
      mustChangePassword: decision.mustChangePassword,
    });
    return applySessionCookies(res, sessionCookies);
  } catch (err) {
    console.error('[auth/client-login] unexpected error', err);
    return jsonError(CLIENT_AUTH_ERRORS.unavailable, 502, 'UNAVAILABLE');
  }
}
