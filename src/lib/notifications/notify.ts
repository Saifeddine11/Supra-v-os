import 'server-only';

import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushNotificationToUsers } from '@/lib/notifications/expo-push';
import type { NotificationPriority, NotificationType, UserRole } from '@/types/database';

export type NotificationInsert = {
  recipient_user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  link_url?: string | null;
};

/**
 * Planifie le push HORS du chemin critique de l'action métier.
 *
 * Pourquoi pas un simple « fire-and-forget » (promesse non attendue) : en
 * serverless (Vercel), le runtime peut être gelé dès la réponse envoyée et la
 * promesse détachée ne serait jamais terminée — push perdu silencieusement.
 * `after()` (Next 15) exécute le travail APRÈS la réponse tout en gardant
 * l'invocation vivante : non bloquant ET fiable.
 *
 * Repli : hors contexte de requête (script/worker), `after()` lève ; on
 * bascule alors sur une exécution détachée protégée (le process reste vivant
 * dans ce cas de figure).
 *
 * Dans tous les cas : aucune exception ne remonte, aucun jeton n'est loggé.
 */
function schedulePush(run: () => Promise<void>): void {
  const safe = () =>
    run().catch((e) => {
      console.error(
        '[insertNotifications] push failed:',
        e instanceof Error ? e.message : 'unknown',
      );
    });

  try {
    after(safe);
  } catch {
    void safe();
  }
}

/**
 * Insert one or more notifications (service role — bypasses RLS).
 *
 * Point d'entrée UNIQUE des notifications in-app : c'est donc ici qu'est
 * déclenché le push mobile, afin que tous les flux existants (assignation,
 * échéance, retard, livraison, validation, alertes critiques…) en héritent
 * sans duplication. Le push suit strictement `recipient_user_id` — aucun
 * envoi à tout le monde.
 *
 * Le push est best-effort : une erreur d'envoi ne doit jamais faire échouer
 * la création de la notification ni l'action métier appelante.
 */
export async function insertNotifications(rows: NotificationInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from('notifications').insert(
    rows.map((r) => ({
      recipient_user_id: r.recipient_user_id,
      type: r.type,
      priority: r.priority,
      title: r.title,
      message: r.message,
      related_entity_type: r.related_entity_type ?? null,
      related_entity_id: r.related_entity_id ?? null,
      link_url: r.link_url ?? null,
      updated_at: now,
    }))
  );

  if (error) {
    console.error('[insertNotifications] insert:', error.message);
    return; // pas de push si la notification n'a pas été créée
  }

  // Notification in-app = source de vérité (déjà écrite ci-dessus).
  // Le push part hors du chemin critique : zéro latence ajoutée à l'action.
  const pushEntries = rows.map((r) => ({
    userId: r.recipient_user_id,
    payload: {
      title: r.title,
      body: r.message,
      priority: (r.priority === 'urgent' || r.priority === 'high'
        ? 'high'
        : 'default') as 'high' | 'default',
      data: {
        type: r.type,
        link_url: r.link_url ?? null,
        related_entity_type: r.related_entity_type ?? null,
        related_entity_id: r.related_entity_id ?? null,
      },
    },
  }));

  schedulePush(() => sendPushNotificationToUsers(pushEntries));
}

export type DedupeKey = {
  recipientUserId: string;
  type: NotificationType;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  /** Dedupe window in hours (default 24). */
  windowHours?: number;
};

/**
 * Creates a notification unless an equivalent one exists in the time window.
 * Returns true if inserted, false if skipped as duplicate.
 */
export async function createNotificationOnce(
  row: NotificationInsert,
  dedupe: DedupeKey
): Promise<{ inserted: boolean }> {
  const windowHours = dedupe.windowHours ?? 24;
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const admin = createAdminClient();

  let q = admin
    .from('notifications')
    .select('id')
    .eq('recipient_user_id', dedupe.recipientUserId)
    .eq('type', dedupe.type)
    .gte('created_at', since)
    .limit(1);

  if (dedupe.relatedEntityType != null) {
    q = q.eq('related_entity_type', dedupe.relatedEntityType);
  } else {
    q = q.is('related_entity_type', null);
  }
  if (dedupe.relatedEntityId != null) {
    q = q.eq('related_entity_id', dedupe.relatedEntityId);
  } else {
    q = q.is('related_entity_id', null);
  }

  const { data: existing } = await q.maybeSingle();
  if (existing) return { inserted: false };

  await insertNotifications([row]);
  return { inserted: true };
}

/**
 * Resolves the Auth user id of an employee for notification delivery.
 *
 * Returns null for inactive, archived, or Auth-less employees: a deactivated
 * collaborator must never receive notifications. Same filters as
 * `getUserIdsByRoles` below, so both recipient paths behave identically.
 */
export async function getEmployeeUserId(employeeId: string | null | undefined): Promise<string | null> {
  if (!employeeId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('employees')
    .select('user_id')
    .eq('id', employeeId)
    .eq('is_active', true)
    .is('archived_at', null)
    .not('user_id', 'is', null)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function getUserIdsByRoles(roles: UserRole[]): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('employees')
    .select('user_id')
    .in('role', roles)
    .eq('is_active', true)
    .is('archived_at', null)
    .not('user_id', 'is', null);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.user_id) ids.add(row.user_id);
  }
  return [...ids];
}

/** Admin + commercial — finance alerts, quotes, invoices. */
export async function getFinanceAlertUserIds(): Promise<string[]> {
  return getUserIdsByRoles(['admin', 'commercial', 'finance']);
}

/** Notify all admins and project managers (in-app). */
export async function notifyAdminsAndPMs(opts: {
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  linkUrl?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): Promise<void> {
  const userIds = await getUserIdsByRoles(['admin', 'project_manager']);
  if (userIds.length === 0) return;

  const rows: NotificationInsert[] = userIds.map((recipient_user_id) => ({
    recipient_user_id,
    type: opts.type,
    priority: opts.priority ?? 'high',
    title: opts.title,
    message: opts.message,
    related_entity_type: opts.relatedEntityType ?? null,
    related_entity_id: opts.relatedEntityId ?? null,
    link_url: opts.linkUrl ?? null,
  }));

  await insertNotifications(rows);
}

export async function notifyFinanceTeam(opts: {
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  linkUrl?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): Promise<void> {
  const userIds = await getFinanceAlertUserIds();
  if (userIds.length === 0) return;
  await insertNotifications(
    userIds.map((recipient_user_id) => ({
      recipient_user_id,
      type: opts.type,
      priority: opts.priority ?? 'high',
      title: opts.title,
      message: opts.message,
      related_entity_type: opts.relatedEntityType ?? null,
      related_entity_id: opts.relatedEntityId ?? null,
      link_url: opts.linkUrl ?? null,
    }))
  );
}
