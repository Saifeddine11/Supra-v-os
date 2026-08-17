import { createClient } from '@/lib/supabase/server';
import type { UserNotificationPreferencesRow } from '@/types/database';

export async function getMyNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferencesRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select(
      'user_id, notification_sound_enabled, notification_sound_urgent_only, notification_sound_volume',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('user_notification_preferences:', error.message);
    return null;
  }
  return data as UserNotificationPreferencesRow | null;
}
