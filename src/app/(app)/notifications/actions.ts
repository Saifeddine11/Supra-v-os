'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: now, updated_at: now })
    .eq('id', id);

  if (error) return actionError(getPostgrestError(error));

  revalidatePath('/notifications');
  revalidatePath('/dashboard');
  revalidatePath('/', 'layout');
  return actionOk();
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: now, updated_at: now })
    .eq('recipient_user_id', user.id)
    .eq('is_read', false);

  if (error) return actionError(getPostgrestError(error));

  revalidatePath('/notifications');
  revalidatePath('/dashboard');
  revalidatePath('/', 'layout');
  return actionOk();
}
