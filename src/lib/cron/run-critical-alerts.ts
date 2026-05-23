import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { AuthContext } from '@/lib/auth/permissions';
import type { Employee } from '@/types/database';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { sendEmail } from '@/lib/email/send-email';
import {
  criticalAlertReminderSubject,
  renderCriticalAlertReminderEmail,
} from '@/lib/email/templates/critical-alert-reminder';
import { createNotificationOnce } from '@/lib/notifications/notify';
import {
  fetchCriticalAlertsWithClient,
  mapCriticalAlertsToActiveApi,
} from '@/lib/data/critical-alerts';

export type CriticalAlertsCronResult = {
  success: boolean;
  usersChecked: number;
  usersReminded: number;
  notificationsInserted: number;
  emailsSent: number;
  errors: string[];
};

/**
 * Rappels critiques toutes les 2h : digest in-app + e-mail (non désactivables par les prefs membre).
 * Indépendant de is_read : seule la résolution métier arrête les alertes.
 */
export async function runCriticalAlertsReminders(): Promise<CriticalAlertsCronResult> {
  const errors: string[] = [];
  let usersChecked = 0;
  let usersReminded = 0;
  let notificationsInserted = 0;
  let emailsSent = 0;
  const admin = createAdminClient();
  const base = appBaseUrl();

  const { data: employees, error: empErr } = await admin
    .from('employees')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .not('user_id', 'is', null);

  if (empErr) {
    errors.push(`employees: ${empErr.message}`);
    return { success: false, usersChecked: 0, usersReminded: 0, notificationsInserted: 0, emailsSent: 0, errors };
  }

  for (const row of employees ?? []) {
    const emp = row as Employee;
    const userId = emp.user_id;
    if (!userId) continue;
    usersChecked += 1;

    const ctx: AuthContext = {
      userId,
      email: emp.email,
      employee: emp,
      role: emp.role,
    };

    try {
      const items = await fetchCriticalAlertsWithClient(admin, ctx);
      const { alerts, criticalCount } = mapCriticalAlertsToActiveApi(items);
      if (criticalCount === 0) continue;

      const criticalLines = alerts
        .filter((a) => a.severity === 'critical')
        .map((a) => a.message);

      const title =
        criticalCount > 1 ? `${criticalCount} actions à traiter` : '1 action à traiter';
      const message = criticalLines.slice(0, 5).join(' · ') || 'Consultez le tableau de bord.';

      const { inserted } = await createNotificationOnce(
        {
          recipient_user_id: userId,
          type: 'critical_alert_reminder',
          priority: 'urgent',
          title,
          message,
          related_entity_type: 'critical_digest',
          related_entity_id: userId,
          link_url: '/dashboard',
        },
        {
          recipientUserId: userId,
          type: 'critical_alert_reminder',
          relatedEntityType: 'critical_digest',
          relatedEntityId: userId,
          windowHours: 2,
        },
      );

      if (!inserted) continue;

      notificationsInserted += 1;
      usersReminded += 1;

      const dashboardUrl = `${base.replace(/\/$/, '')}/dashboard`;
      const { html, text } = renderCriticalAlertReminderEmail({
        recipientName: emp.full_name?.split(/\s+/)[0] ?? 'équipe',
        criticalCount,
        summaryLines: criticalLines.length ? criticalLines : [message],
        dashboardUrl,
      });

      const r = await sendEmail({
        to: emp.email,
        subject: criticalAlertReminderSubject(criticalCount),
        html,
        text,
      });
      if (r.ok) emailsSent += 1;
      else if (r.error) errors.push(`email ${emp.email}: ${r.error}`);
    } catch (e) {
      errors.push(`${emp.email}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    success: errors.length === 0,
    usersChecked,
    usersReminded,
    notificationsInserted,
    emailsSent,
    errors,
  };
}
