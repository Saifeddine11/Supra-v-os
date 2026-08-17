/**
 * Server-side permission helpers
 * --------------------------------------------------------------------------
 * Use these in Server Components, Server Actions, and Route Handlers to
 * enforce role-based access. Never trust the client.
 */

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { UserRole, Employee } from '@/types/database';
import { redirect } from 'next/navigation';
import { withDevTime } from '@/lib/perf/dev-time';

export interface AuthContext {
  userId: string;
  email: string;
  employee: Employee | null;
  role: UserRole | null;
}

/**
 * Fetch the current authenticated user + their employee record + role.
 * Deduplicated with React.cache() for the lifetime of the request
 * (layout + RBAC + page + data helpers share one Auth round-trip).
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  return withDevTime('auth context', async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: employeeRow } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const employee = (employeeRow ?? null) as Employee | null;

    return {
      userId: user.id,
      email: user.email ?? '',
      employee,
      role: employee?.role ?? null,
    };
  });
});

/**
 * Require an authenticated user. Redirects to /login if not.
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  return ctx;
}

/**
 * Require one of the listed roles. Redirects to /access-denied if denied.
 */
export async function requireRole(roles: UserRole[]): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctx.role || !roles.includes(ctx.role)) {
    redirect('/access-denied');
  }
  return ctx;
}

/**
 * Convenience wrappers
 */
export async function requireAdmin() {
  return requireRole(['admin']);
}

export async function requireAdminOrPM() {
  return requireRole(['admin', 'project_manager']);
}

export async function requireFinancialRole() {
  return requireRole(['admin', 'commercial', 'finance']);
}

export async function requireFinancialWriteRole() {
  return requireRole(['admin', 'commercial', 'finance']);
}
