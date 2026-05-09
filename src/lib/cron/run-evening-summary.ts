import 'server-only';

import { addDays, endOfDay, format, startOfDay } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { sendEmail } from '@/lib/email/send-email';
import {
  eveningSummarySubject,
  renderEveningSummaryEmail,
} from '@/lib/email/templates/evening-summary';
import { createNotificationOnce } from '@/lib/notifications/notify';
import { getCronEmailPrefs } from '@/lib/cron/user-notification-prefs';

export type EveningSummaryResult = {
  success: boolean;
  employeesProcessed: number;
  notificationsCreated: number;
  emailsSent: number;
  emailsSkipped: number;
  errors: string[];
};

export async function runEveningSummary(): Promise<EveningSummaryResult> {
  const errors: string[] = [];
  let notificationsCreated = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;
  let employeesProcessed = 0;

  const admin = createAdminClient();
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const tomorrow = addDays(now, 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const dateLabel = format(now, 'EEEE d MMMM yyyy');
  const base = appBaseUrl();

  const { data: employees, error: empErr } = await admin
    .from('employees')
    .select('id, user_id, full_name, email, is_active')
    .eq('is_active', true)
    .is('archived_at', null)
    .not('user_id', 'is', null);

  if (empErr) {
    return {
      success: false,
      employeesProcessed: 0,
      notificationsCreated: 0,
      emailsSent: 0,
      emailsSkipped: 0,
      errors: [empErr.message],
    };
  }

  for (const emp of employees ?? []) {
    if (!emp.user_id) continue;

    const prefs = await getCronEmailPrefs(admin, emp.user_id);
    if (!prefs.evening_summary_enabled) {
      continue;
    }

    employeesProcessed += 1;

    const { data: allAssigned } = await admin
      .from('tasks')
      .select('id,title,status,deadline,completed_at')
      .eq('assignee_id', emp.id);

    const tasks = allAssigned ?? [];
    const completedToday = tasks.filter(
      (t) =>
        t.status === 'done' &&
        t.completed_at &&
        new Date(t.completed_at) >= dayStart &&
        new Date(t.completed_at) <= dayEnd
    );
    const remaining = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived');
    const overdue = remaining.filter((t) => t.deadline && new Date(t.deadline) < now);
    const tomorrowDue = remaining.filter((t) => {
      if (!t.deadline) return false;
      const d = new Date(t.deadline);
      return d.toISOString().slice(0, 10) === tomorrowStr;
    });

    if (
      completedToday.length === 0 &&
      remaining.length === 0 &&
      overdue.length === 0 &&
      tomorrowDue.length === 0
    ) {
      continue;
    }

    const line = (t: (typeof tasks)[0]) => (t.deadline ? `${t.title} — ${format(new Date(t.deadline), 'HH:mm')}` : t.title);

    const message = [
      completedToday.length ? `Traité aujourd'hui :\n${completedToday.map((t) => `• ${line(t)}`).join('\n')}` : '',
      remaining.length ? `En cours :\n${remaining.slice(0, 12).map((t) => `• ${line(t)}`).join('\n')}` : '',
      overdue.length ? `En retard :\n${overdue.map((t) => `• ${line(t)}`).join('\n')}` : '',
      tomorrowDue.length ? `À traiter demain :\n${tomorrowDue.map((t) => `• ${line(t)}`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const notificationRow = {
      recipient_user_id: emp.user_id,
      type: 'evening_summary' as const,
      priority: overdue.length > 0 ? ('high' as const) : ('normal' as const),
      title: 'Bilan de fin de journée',
      message,
      link_url: `${base}/tasks`,
    };
    const { inserted } = await createNotificationOnce(notificationRow, {
      recipientUserId: emp.user_id,
      type: 'evening_summary',
      relatedEntityType: null,
      relatedEntityId: null,
      windowHours: 16,
    });
    if (!inserted) continue;
    notificationsCreated += 1;

    const { html, text } = renderEveningSummaryEmail({
      recipientName: emp.full_name.split(/\s+/)[0] ?? emp.full_name,
      date: dateLabel,
      completedTasks: completedToday.map(line),
      remainingTasks: remaining.slice(0, 15).map(line),
      overdueTasks: overdue.map(line),
      tomorrowTasks: tomorrowDue.map(line),
      dashboardUrl: `${base}/dashboard`,
    });

    if (prefs.email_reminders_enabled) {
      const r = await sendEmail({
        to: emp.email,
        subject: eveningSummarySubject(),
        html,
        text,
      });
      if (r.ok) emailsSent += 1;
      else if (r.skipped) emailsSkipped += 1;
      else if (r.error) errors.push(`${emp.email}: ${r.error}`);
    }
  }

  return {
    success: errors.length === 0,
    employeesProcessed,
    notificationsCreated,
    emailsSent,
    emailsSkipped,
    errors,
  };
}
