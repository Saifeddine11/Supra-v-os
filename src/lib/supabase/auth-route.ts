import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';

/**
 * Route-handler Supabase client that copies session cookies onto the redirect
 * response. NextResponse.redirect() does not inherit cookies from a leftover
 * NextResponse.next() unless they are set on the redirect itself.
 */
export function createAuthRedirectClient(request: NextRequest) {
  const supabaseUrl = normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

  if (!supabaseUrl || !anonKey) {
    return {
      supabase: null,
      missingConfig: true as const,
      redirectTo(pathnameAndSearch: string) {
        return NextResponse.redirect(new URL(pathnameAndSearch, request.url));
      },
    };
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pendingCookies.push({ name, value, options });
          try {
            request.cookies.set(name, value);
          } catch {
            // NextRequest cookies can be immutable in Route Handlers.
          }
        });
      },
    },
  });

  return {
    supabase,
    missingConfig: false as const,
    redirectTo(pathnameAndSearch: string) {
      const response = NextResponse.redirect(new URL(pathnameAndSearch, request.url));
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      return response;
    },
  };
}
