import 'server-only';

import { endOfDay, format, isWithinInterval, startOfDay } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { sendEmail } from '@/lib/email/send-email';
import {
  morningReminderSubject,
  renderMorningReminderEmail,
} from '@/lib/email/templates/morning-reminder';
import { createNotificationOnce } from '@/lib/notifications/notify';
import { getCronEmailPrefs } from '@/lib/cron/user-notification-prefs';

export type MorningRemindersResult = {
  success: boolean;
  employeesProcessed: number;
  notificationsCreated: number;
  emailsSent: number;
  emailsSkipped: number;
  errors: string[];
};

export async function runMorningReminders(): Promise<MorningRemindersResult> {
  const errors: string[] = [];
  let notificationsCreated = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;
  let employeesProcessed = 0;

  const admin = createAdminClient();
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const dateLabel = format(now, 'EEEE d MMMM yyyy');

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

  const base = appBaseUrl();

  for (const emp of employees ?? []) {
    if (!emp.user_id) continue;

    const prefs = await getCronEmailPrefs(admin, emp.user_id);
    if (!prefs.morning_reminder_enabled) {
      continue;
    }

    employeesProcessed += 1;

    const { data: tasks } = await admin
      .from('tasks')
      .select('id,title,deadline,priority,status')
      .eq('assignee_id', emp.id)
      .not('status', 'in', '(done,archived)');

    const open = tasks ?? [];
    const overdue: typeof open = [];
    const dueToday: typeof open = [];
    const urgentOpen: typeof open = [];

    for (const t of open) {
      if (t.priority === 'urgent') urgentOpen.push(t);
      if (!t.deadline) continue;
      const d = new Date(t.deadline);
      if (d.getTime() < now.getTime()) overdue.push(t);
      else if (isWithinInterval(d, { start: dayStart, end: dayEnd })) dueToday.push(t);
    }

    if (dueToday.length === 0 && overdue.length === 0 && urgentOpen.length === 0) {
      continue;
    }

    const fmtTask = (t: (typeof open)[0]) => {
      const time = t.deadline ? format(new Date(t.deadline), 'HH:mm') : '';
      return time ? `${t.title} — ${time}` : t.title;
    };

    const tasksToday = dueToday.map(fmtTask);
    const urgentTasks = urgentOpen
      .filter((t) => !dueToday.some((d) => d.id === t.id))
      .map(fmtTask);
    const overdueTasks = overdue.map(fmtTask);

    const messageLines = [
      ...tasksToday.map((l) => `• ${l}`),
      ...(urgentTasks.length ? ['Urgent :', ...urgentTasks.map((l) => `• ${l}`)] : []),
      ...(overdueTasks.length ? ['En retard :', ...overdueTasks.map((l) => `• ${l}`)] : []),
    ].join('\n');

    const notificationRow = {
      recipient_user_id: emp.user_id,
      type: 'morning_summary' as const,
      priority: overdue.length > 0 ? ('high' as const) : ('normal' as const),
      title: 'Rappel matinal — tâches du jour',
      message: messageLines,
      link_url: `${base}/tasks`,
    };
    const { inserted } = await createNotificationOnce(notificationRow, {
      recipientUserId: emp.user_id,
      type: 'morning_summary',
      relatedEntityType: null,
      relatedEntityId: null,
      windowHours: 16,
    });
    if (!inserted) continue;
    notificationsCreated += 1;

    const { html, text } = renderMorningReminderEmail({
      recipientName: emp.full_name.split(/\s+/)[0] ?? emp.full_name,
      date: dateLabel,
      tasksToday: tasksToday.length
        ? tasksToday
        : ['Aucune tâche avec échéance aujourd’hui — voir urgent ou en retard ci-dessous.'],
      urgentTasks,
      overdueTasks,
      dashboardUrl: `${base}/dashboard`,
    });

    if (prefs.email_reminders_enabled) {
      const r = await sendEmail({
        to: emp.email,
        subject: morningReminderSubject(),
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
