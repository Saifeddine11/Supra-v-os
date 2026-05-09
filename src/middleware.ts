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

const PUBLIC_PATHS = [
  '/login',
  '/portal/',          // /portal/client/[id] — token-based, no auth
  '/api/cron/',        // protected by CRON_SECRET, not by Supabase auth
  '/api/dev/',         // dev-only helpers (handlers still gate by NODE_ENV)
  '/api/portal/',      // portal API uses token validation, not auth
  '/api/auth/login',   // server-side sign-in (session cookies) — must stay public
];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p));

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabaseUrl = normalizeSupabaseProjectUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const supabase = createServerClient(supabaseUrl!, anonKey!, {
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

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to /login for protected routes if not authenticated
  if (!user && !isPublic(request.nextUrl.pathname) && request.nextUrl.pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect / to dashboard or login
  if (request.nextUrl.pathname === '/') {
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
    '/((?!_next/static|_next/image|favicon.ico|api/auth/login|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
