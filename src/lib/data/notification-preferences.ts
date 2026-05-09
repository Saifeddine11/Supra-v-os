import { createClient } from '@/lib/supabase/server';
import type { UserNotificationPreferencesRow } from '@/types/database';

export async function getMyNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferencesRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('user_notification_preferences:', error.message);
    return null;
  }
  return data as UserNotificationPreferencesRow | null;
}
