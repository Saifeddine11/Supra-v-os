/**
 * Push notifications mobiles (Expo).
 *
 * Cycle :
 *   1. après connexion → demande de permission (non bloquante)
 *   2. récupération de l'ExpoPushToken
 *   3. enregistrement dans `mobile_push_tokens` via le client anon (RLS :
 *      chacun n'écrit que ses propres jetons)
 *   4. à la déconnexion → le jeton de CET appareil est désactivé
 *
 * Si l'utilisateur refuse, l'app continue de fonctionner normalement :
 * aucune modale bloquante, aucune erreur remontée à l'écran.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { logDevError } from '@/lib/errors';

/** Bannière + son même quand l'app est au premier plan. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Canal Android obligatoire pour afficher les notifications. */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications Supra',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#FF3D0A',
    });
  } catch (e) {
    logDevError('push:androidChannel', e);
  }
}

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

/**
 * Demande la permission puis renvoie l'ExpoPushToken, ou null si refusé /
 * indisponible (simulateur, Expo Go sans projectId, erreur réseau).
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    // Les push natifs ne fonctionnent pas sur simulateur/émulateur.
    if (!Device.isDevice) return null;

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      // Ne redemande pas si l'utilisateur a explicitement refusé.
      if (!existing.canAskAgain) return null;
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    const id = projectId();
    const token = await Notifications.getExpoPushTokenAsync(
      id ? { projectId: id } : undefined,
    );
    return token.data ?? null;
  } catch (e) {
    logDevError('push:getToken', e);
    return null;
  }
}

/**
 * Enregistre (ou réactive) le jeton de cet appareil pour l'utilisateur.
 * `expo_push_token` est unique : un onConflict réattribue proprement le
 * jeton si l'appareil change de compte — aucun doublon possible.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  const token = await getExpoPushToken();
  if (!token) return null;

  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from('mobile_push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        platform: Platform.OS,
        device_name: Device.deviceName ?? null,
        is_active: true,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: 'expo_push_token' },
    );
    if (error) {
      logDevError('push:register', error);
      return null;
    }
    return token;
  } catch (e) {
    logDevError('push:register', e);
    return null;
  }
}

/** Désactive le jeton de CET appareil (déconnexion). */
export async function deactivatePushToken(): Promise<void> {
  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId() ? { projectId: projectId() as string } : undefined,
    ).catch(() => null);
    if (!token?.data) return;

    await supabase
      .from('mobile_push_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('expo_push_token', token.data);
  } catch (e) {
    logDevError('push:deactivate', e);
  }
}

/**
 * Destination in-app d'une notification push.
 * Prudence volontaire : on ne navigue en profondeur que sur des entités
 * connues et sûres ; sinon on ouvre le centre de notifications.
 */
export function routeForPushData(data: Record<string, unknown> | undefined): string {
  const entityType = typeof data?.related_entity_type === 'string' ? data.related_entity_type : null;
  const entityId = typeof data?.related_entity_id === 'string' ? data.related_entity_id : null;

  if (entityId) {
    if (entityType === 'task') return `/tasks/${entityId}`;
    if (entityType === 'video') return `/videos/${entityId}`;
  }
  return '/notifications';
}
