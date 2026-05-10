'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';

export async function changeStaffPasswordAction(
  password: string,
  confirmPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getAuthContext();
  if (!ctx?.userId) {
    return { ok: false, error: 'Non connecté.' };
  }

  const pw = password.trim();
  if (pw.length < 8) {
    return { ok: false, error: 'Le mot de passe doit contenir au moins 8 caractères.' };
  }
  if (pw !== confirmPassword.trim()) {
    return { ok: false, error: 'Les mots de passe ne correspondent pas.' };
  }

  const supabase = await createClient();
  const { error: pwErr } = await supabase.auth.updateUser({ password: pw });
  if (pwErr) {
    return { ok: false, error: pwErr.message };
  }

  const { error: empErr } = await supabase
    .from('employees')
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq('user_id', ctx.userId);

  if (empErr) {
    return { ok: false, error: empErr.message };
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}
