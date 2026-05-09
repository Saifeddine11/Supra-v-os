import type { UserNotificationPreferencesRow } from '@/types/database';

export const DEFAULT_NOTIFICATION_PREFS: Omit<UserNotificationPreferencesRow, 'user_id' | 'updated_at'> = {
  email_reminders_enabled: true,
  morning_reminder_enabled: true,
  evening_summary_enabled: true,
  deadline_alerts_enabled: true,
};
