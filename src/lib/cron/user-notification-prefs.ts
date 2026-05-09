import 'server-only';

import type { ServiceRoleClient } from '@/lib/supabase/admin';
import { DEFAULT_NOTIFICATION_PREFS } from '@/data/notification-defaults';
import type { UserNotificationPreferencesRow } from '@/types/database';

export async function getCronEmailPrefs(
  admin: ServiceRoleClient,
  userId: string
): Promise<Pick<
  UserNotificationPreferencesRow,
  | 'email_reminders_enabled'
  | 'morning_reminder_enabled'
  | 'evening_summary_enabled'
  | 'deadline_alerts_enabled'
>> {
  const { data } = await admin
    .from('user_notification_preferences')
    .select(
      'email_reminders_enabled, morning_reminder_enabled, evening_summary_enabled, deadline_alerts_enabled'
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return { ...DEFAULT_NOTIFICATION_PREFS };
  return {
    email_reminders_enabled: data.email_reminders_enabled ?? DEFAULT_NOTIFICATION_PREFS.email_reminders_enabled,
    morning_reminder_enabled:
      data.morning_reminder_enabled ?? DEFAULT_NOTIFICATION_PREFS.morning_reminder_enabled,
    evening_summary_enabled:
      data.evening_summary_enabled ?? DEFAULT_NOTIFICATION_PREFS.evening_summary_enabled,
    deadline_alerts_enabled:
      data.deadline_alerts_enabled ?? DEFAULT_NOTIFICATION_PREFS.deadline_alerts_enabled,
  };
}
