import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthContext } from '@/lib/auth/permissions';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';
import type { Employee } from '@/types/database';

type UserScopedClient = SupabaseClient<any, 'public', any>;

/**
 * Mobile session: verify the caller's access token with the anon key.
 * Never accepts or returns the service role.
 */
export async function createUserClientFromAccessToken(accessToken: string): Promise<{
  supabase: UserScopedClient;
  ctx: AuthContext;
} | null> {
  const token = accessToken.trim();
  if (!token) return null;
  const url = normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as UserScopedClient;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: employeeRow } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', data.user.id)
    .maybeSingle();
  const employee = (employeeRow ?? null) as Employee | null;

  return {
    supabase,
    ctx: {
      userId: data.user.id,
      email: data.user.email ?? '',
      employee,
      role: employee?.role ?? null,
    },
  };
}
