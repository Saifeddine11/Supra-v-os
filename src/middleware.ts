/**
 * Next.js Middleware — Auth session refresh
 * --------------------------------------------------------------------------
 * Runs on every request to:
 *   1. Refresh the Supabase auth session cookie if expiring
 *   2. Redirect unauthenticated users away from protected routes
 *   3. Let the public portal & login routes through unauthenticated
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';
import {
  AUTH_SET_PASSWORD_PATH,
  hasPasswordSetupSearchParams,
} from '@/lib/auth/password-setup';
import { CLIENT_LOGIN_PATH, isClientProtectedPath } from '@/lib/clients/auth-errors';

const PUBLIC_PATHS = [
  '/login',
  '/auth/',            // callback, confirm, set-password — invite/recovery must not hit /login
  '/portal/',          // /portal/client/[id] — token-based, no auth
  '/api/cron/',        // protected by CRON_SECRET, not by Supabase auth
  '/api/dev/',         // dev-only helpers (handlers still gate by NODE_ENV)
  '/api/portal/',      // portal API uses token validation, not auth
  '/api/client/',      // client invoice PDF etc. — handlers enforce session; never HTML-redirect to staff /login
  '/api/auth/login',   // server-side sign-in (session cookies) — must stay public
  '/api/auth/client-login',
  '/api/auth/client-logout',
  CLIENT_LOGIN_PATH,   // dedicated client login — staff /login stays staff-only
];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p));

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabaseUrl = normalizeSupabaseProjectUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  /** Avoid throwing inside Edge — missing public env breaks createServerClient and yields MIDDLEWARE_INVOCATION_FAILED on Vercel. */
  if (!supabaseUrl || !anonKey) {
    console.error(
      '[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (check Vercel → Settings → Environment Variables → Production)',
    );
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (isPublic(pathname)) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  let user = null;
  const sessionStart = performance.now();
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
  } catch (e) {
    console.error('[middleware] auth.getUser failed', e instanceof Error ? e.message : e);
  }
  const sessionMs = Math.round(performance.now() - sessionStart);
  if (process.env.NODE_ENV === 'development' || process.env.PERF_LOGIN_LOGS === '1') {
    console.info(`[perf] middleware session check: ${sessionMs} ms`);
    response.headers.set('Server-Timing', `mwSession;dur=${sessionMs}`);
  }

  /**
   * Routes API notifications : réponse JSON 401 si non connecté.
   * Évite une redirection 307 → page /login (HTML) quand on ouvre l’URL dans l’onglet
   * ou curl sans cookie — sinon on peut croire à un « 404 » ou à une route absente.
   */
  if (!user && pathname === '/api/notifications/critical-active') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user && pathname === '/api/notifications/bell-sync') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user && pathname === '/api/ai/chat') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user && pathname.startsWith('/api/ai/actions/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user && pathname === '/api/ai/context') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user && pathname === '/api/discord/admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  /**
   * Invite / recovery links often land on Site URL (`/`) or `/login` with `?code=`
   * or `token_hash`. Never send those to the password login form.
   * Hash tokens (#access_token) are not visible here — the login page forwards them.
   */
  if (hasPasswordSetupSearchParams(request.nextUrl.searchParams)) {
    if (pathname !== AUTH_SET_PASSWORD_PATH && !pathname.startsWith('/auth/')) {
      const url = request.nextUrl.clone();
      url.pathname = AUTH_SET_PASSWORD_PATH;
      const redirect = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => {
        redirect.cookies.set(cookie.name, cookie.value);
      });
      return redirect;
    }
  }

  // Anciens e-mails pointaient vers /change-password (layout app protégé).
  if (pathname === '/change-password' && !user) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_SET_PASSWORD_PATH;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value);
    });
    return redirect;
  }

  // Unauthenticated client-area routes go to /client/login, never staff /login.
  if (!user && isClientProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = CLIENT_LOGIN_PATH;
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to /login for protected routes if not authenticated
  if (!user && !isPublic(pathname) && pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect / to dashboard or login
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = user ? '/dashboard' : '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Exclude /api/auth/login so middleware never runs on that path.
     * Some stacks have had issues with POST bodies / fetch when the edge
     * middleware pipeline touches the same request before the Route Handler.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth/login|api/auth/client-login|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
