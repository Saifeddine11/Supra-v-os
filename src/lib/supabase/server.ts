/**
 * Supabase SERVER client
 * --------------------------------------------------------------------------
 * Use in:
 *   - Server Components       (app/.../page.tsx)
 *   - Server Actions          ('use server' functions)
 *   - Route Handlers          (app/api/.../route.ts)
 *
 * Reads/writes the auth session via Next.js cookies. RLS is enforced.
 *
 * For privileged operations that must bypass RLS (cron jobs, portal token
 * validation, PDF generation), use `createAdminClient` from `./admin.ts`.
 */

import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';

export async function createClient() {
  const cookieStore = await cookies();
  const url = normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return createServerClient<Database>(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — cookies are read-only.
          // Middleware will refresh the session on the next request.
        }
      },
    },
  });
}
