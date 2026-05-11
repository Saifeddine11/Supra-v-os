import type { UserNotificationPreferencesRow } from '@/types/database';
import type { NotificationSoundLevel } from '@/lib/notifications/notification-sound-level';

/** Préférences sonores normalisées (alignées sur les colonnes DB). */
export type NotificationSoundPrefs = {
  notification_sound_enabled: boolean;
  notification_sound_urgent_only: boolean;
  notification_sound_volume: 'low' | 'medium' | 'high';
};

export const DEFAULT_NOTIFICATION_SOUND_PREFS: NotificationSoundPrefs = {
  notification_sound_enabled: true,
  notification_sound_urgent_only: false,
  notification_sound_volume: 'medium',
};

function normalizeVolume(raw: unknown): 'low' | 'medium' | 'high' {
  return raw === 'low' || raw === 'high' || raw === 'medium' ? raw : 'medium';
}

/**
 * Normalise une ligne `user_notification_preferences` (ou null).
 * Fonction pure, utilisable côté serveur et côté client.
 */
export function notificationSoundPrefsFromRow(
  row: UserNotificationPreferencesRow | null | undefined,
): NotificationSoundPrefs {
  if (!row) return DEFAULT_NOTIFICATION_SOUND_PREFS;
  return {
    notification_sound_enabled: row.notification_sound_enabled ?? true,
    notification_sound_urgent_only: row.notification_sound_urgent_only ?? false,
    notification_sound_volume: normalizeVolume(row.notification_sound_volume),
  };
}

/**
 * Indique si les préférences autorisent un son pour ce niveau (logique pure, sans Audio).
 */
export function canPlayNotificationSound(
  level: NotificationSoundLevel,
  prefs: NotificationSoundPrefs | null,
): boolean {
  if (!prefs?.notification_sound_enabled) return false;
  if (level === 'silent' || level === 'soft') return false;
  if (prefs.notification_sound_urgent_only) {
    return level === 'urgent' || level === 'critical';
  }
  return true;
}
