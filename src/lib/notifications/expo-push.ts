import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Envoi de notifications push Expo (appareils mobiles du staff).
 *
 * Aucune dépendance ajoutée : appel direct de l'API Expo Push via fetch.
 * Le jeton d'accès Expo (EXPO_ACCESS_TOKEN) n'est requis que si la sécurité
 * renforcée est activée sur le projet Expo — sinon l'appel fonctionne sans.
 *
 * Règle de diffusion : le push suit STRICTEMENT le destinataire de la
 * notification in-app (recipient_user_id). Pas de broadcast ici.
 */

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
/** L'API Expo accepte 100 messages par requête. */
const CHUNK_SIZE = 100;

export type PushPayload = {
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
  /** 'default' | 'high' — mappé sur la priorité de la notification. */
  priority?: 'default' | 'high';
};

type ExpoMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  sound: 'default';
  priority: 'default' | 'high';
  channelId: 'default';
};

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

/**
 * Retire tout ExpoPushToken d'un texte destiné aux logs.
 * L'API Expo peut renvoyer le jeton fautif dans un message d'erreur 400 :
 * on garantit ici qu'aucun jeton ne finit dans les logs serveur.
 */
function redact(value: unknown): string {
  const text =
    value instanceof Error ? value.message : typeof value === 'string' ? value : String(value);
  return text.replace(/Expo(nent)?PushToken\[[^\]]*\]/g, 'ExpoPushToken[redacted]');
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Format Expo attendu : ExpoPushToken[xxx] ou ExponentPushToken[xxx]. */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token.trim());
}

async function deactivateTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin
      .from('mobile_push_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('expo_push_token', tokens);
  } catch (e) {
    console.error('[expo-push] deactivate tokens failed:', redact(e));
  }
}

/**
 * Envoie un lot de messages et désactive les jetons refusés par Expo
 * (DeviceNotRegistered = app désinstallée / jeton périmé).
 */
async function sendChunk(messages: ExpoMessage[]): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    console.error('[expo-push] HTTP', res.status, redact(await res.text().catch(() => '')));
    return;
  }

  const json = (await res.json()) as { data?: ExpoTicket[] };
  const tickets = json.data ?? [];
  const dead: string[] = [];

  tickets.forEach((ticket, i) => {
    if (ticket.status !== 'error') return;
    const code = ticket.details?.error;
    // Ne jamais logger le jeton complet.
    console.error('[expo-push] ticket error:', redact(code ?? ticket.message ?? 'unknown'));
    if (code === 'DeviceNotRegistered' && messages[i]) {
      dead.push(messages[i].to);
    }
  });

  await deactivateTokens(dead);
}

/**
 * Envoie une notification push à tous les appareils actifs d'un utilisateur.
 * Ne lève jamais : un échec de push ne doit pas casser l'action métier.
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!userId) return;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('mobile_push_tokens')
      .select('expo_push_token')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('[expo-push] load tokens:', redact(error.message));
      return;
    }

    const tokens = (data ?? [])
      .map((r) => (r as { expo_push_token: string }).expo_push_token)
      .filter((t) => typeof t === 'string' && isExpoPushToken(t));
    if (tokens.length === 0) return;

    const messages: ExpoMessage[] = tokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body ?? undefined,
      data: payload.data ?? {},
      sound: 'default',
      priority: payload.priority ?? 'default',
      channelId: 'default',
    }));

    for (const part of chunk(messages, CHUNK_SIZE)) {
      await sendChunk(part);
    }
  } catch (e) {
    console.error('[expo-push] send failed:', redact(e));
  }
}

/** Envoi groupé (une notification par destinataire distinct). */
export async function sendPushNotificationToUsers(
  entries: { userId: string; payload: PushPayload }[],
): Promise<void> {
  await Promise.all(
    entries.map((e) => sendPushNotificationToUser(e.userId, e.payload)),
  );
}
