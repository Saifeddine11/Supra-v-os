'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureEmployeeLinkedByEmail } from '@/lib/employees/auth-provision';
import { isMissingClientUsersTable } from '@/lib/clients/auth-provision';
import { CLIENT_HOME_PATH, CLIENT_LOGIN_PATH } from '@/lib/clients/auth-errors';

export type FinalizePasswordSetupResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; redirectTo?: string };

/**
 * After supabase.auth.updateUser({ password }) on the client.
 * Does not touch the password — only employee/client link + must_change_password flag.
 * Staff keep /dashboard. Clients are never inserted into employees.
 */
export async function finalizePasswordSetupAction(): Promise<FinalizePasswordSetupResult> {
  const ctx = await getAuthContext();
  if (!ctx?.userId) {
    return { ok: false, error: 'Session expirée. Réessayez depuis le lien d’invitation.' };
  }

  try {
    const admin = createAdminClient();

    const [{ data: clientUserRow }, { data: employeeRow }] = await Promise.all([
      admin.from('client_users').select('id, is_active').eq('user_id', ctx.userId).maybeSingle(),
      admin.from('employees').select('id').eq('user_id', ctx.userId).maybeSingle(),
    ]);

    const isEmployee = Boolean(employeeRow) || Boolean(ctx.employee);
    const isClient = Boolean(clientUserRow);

    // Never try to attach a client Auth user to employees.
    if (isEmployee || !isClient) {
      await ensureEmployeeLinkedByEmail(admin, ctx.userId, ctx.email);
      const { error } = await admin
        .from('employees')
        .update({ must_change_password: false, updated_at: new Date().toISOString() })
        .eq('user_id', ctx.userId);
      if (error) return { ok: false, error: error.message };
    }

    if (isClient) {
      const { error: clientUserError } = await admin
        .from('client_users')
        .update({ must_change_password: false, updated_at: new Date().toISOString() })
        .eq('user_id', ctx.userId);
      if (clientUserError && !isMissingClientUsersTable(clientUserError)) {
        return { ok: false, error: clientUserError.message };
      }
    }

    revalidatePath('/', 'layout');

    if (isEmployee) return { ok: true, redirectTo: '/dashboard' };
    if (isClient && clientUserRow && clientUserRow.is_active !== false) {
      return { ok: true, redirectTo: CLIENT_HOME_PATH };
    }
    if (isClient) return { ok: true, redirectTo: CLIENT_LOGIN_PATH };
    return { ok: true, redirectTo: '/dashboard' };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : 'Mot de passe enregistré, mais le compte n’a pas pu être finalisé.',
    };
  }
}
