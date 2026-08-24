/**
 * GET /api/auth/client-logout
 * Clears Auth session cookies, then redirects to /client/login.
 * Used when a Server Component cannot persist Set-Cookie from signOut.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';
import { CLIENT_LOGIN_PATH } from '@/lib/clients/auth-errors';

const ALLOWED_ERRORS = new Set(['disabled', 'access', 'unavailable']);

export async function GET(request: NextRequest) {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const dest = new URL(CLIENT_LOGIN_PATH, request.url);
  const errorParam = request.nextUrl.searchParams.get('error');
  if (errorParam && ALLOWED_ERRORS.has(errorParam)) {
    dest.searchParams.set('error', errorParam);
  }

  if (!rawUrl || !rawAnon) {
    console.error('[auth/client-logout] missing public Supabase env');
    return NextResponse.redirect(dest);
  }

  const sessionCookies: { name: string; value: string; options: CookieOptions }[] = [];
  const supabase = createServerClient(normalizeSupabaseProjectUrl(rawUrl), rawAnon, {
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
    await supabase.auth.signOut();
  } catch (e) {
    console.error('[auth/client-logout] signOut', e instanceof Error ? e.message : e);
  }

  const res = NextResponse.redirect(dest);
  sessionCookies.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, options);
  });
  return res;
}

export async function POST(request: NextRequest) {
  return GET(request);
}
