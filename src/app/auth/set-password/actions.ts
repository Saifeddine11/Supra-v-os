'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureEmployeeLinkedByEmail } from '@/lib/employees/auth-provision';

/**
 * After supabase.auth.updateUser({ password }) on the client.
 * Does not touch the password — only employee link + must_change_password flag.
 */
export async function finalizePasswordSetupAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const ctx = await getAuthContext();
  if (!ctx?.userId) {
    return { ok: false, error: 'Session expirée. Réessayez depuis le lien d’invitation.' };
  }

  try {
    const admin = createAdminClient();
    await ensureEmployeeLinkedByEmail(admin, ctx.userId, ctx.email);
    const { error } = await admin
      .from('employees')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('user_id', ctx.userId);
    if (error) return { ok: false, error: error.message };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : 'Mot de passe enregistré, mais le profil employé n’a pas pu être lié.',
    };
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}
