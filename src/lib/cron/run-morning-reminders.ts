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
import { fetchTaskIdsAssignedToEmployee } from '@/lib/data/task-assignments';
import {
  isTaskActiveForCriticalAlerts,
  isTaskOverdueForAlert,
  isTaskUrgentForAlert,
  TASK_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL,
} from '@/lib/alerts/active-alert-rules';
import type { TaskPriority, TaskStatus, UserRole } from '@/types/database';
import { sendDiscordMorningDigest } from '@/lib/discord/task-discord';

export type MorningRemindersResult = {
  success: boolean;
  employeesProcessed: number;
  notificationsCreated: number;
  emailsSent: number;
  emailsSkipped: number;
  discordDigestsSent: number;
  errors: string[];
};

export async function runMorningReminders(): Promise<MorningRemindersResult> {
  const errors: string[] = [];
  let notificationsCreated = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;
  let discordDigestsSent = 0;
  let employeesProcessed = 0;

  const admin = createAdminClient();
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const dateLabel = format(now, 'EEEE d MMMM yyyy');

  let empQuery = admin
    .from('employees')
    .select('id, user_id, full_name, email, role, discord_user_id, is_active')
    .eq('is_active', true)
    .is('archived_at', null)
    .not('user_id', 'is', null);

  let { data: employees, error: empErr } = await empQuery;

  if (empErr && /discord_user_id/i.test(empErr.message)) {
    const fallback = await admin
      .from('employees')
      .select('id, user_id, full_name, email, role, is_active')
      .eq('is_active', true)
      .is('archived_at', null)
      .not('user_id', 'is', null);
    employees = (fallback.data ?? []).map((row) => ({
      ...row,
      discord_user_id: null,
    }));
    empErr = fallback.error;
  }

  if (empErr) {
    return {
      success: false,
      employeesProcessed: 0,
      notificationsCreated: 0,
      emailsSent: 0,
      emailsSkipped: 0,
      discordDigestsSent: 0,
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

    const fromPivot = await fetchTaskIdsAssignedToEmployee(admin, emp.id as string);
    const taskOrParts = [`assignee_id.eq.${emp.id}`];
    if (fromPivot.length) taskOrParts.push(`id.in.(${fromPivot.join(',')})`);

    const { data: tasks } = await admin
      .from('tasks')
      .select('id,title,deadline,priority,status,client_id')
      .or(taskOrParts.join(','))
      .not('status', 'in', TASK_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL);

    const open = tasks ?? [];
    const overdue: typeof open = [];
    const dueToday: typeof open = [];
    const urgentOpen: typeof open = [];

    for (const t of open) {
      const status = t.status as TaskStatus;
      const deadline = t.deadline as string | null;
      if (!isTaskActiveForCriticalAlerts({ status, deadline })) continue;
      if (isTaskUrgentForAlert({ status, priority: t.priority as TaskPriority })) urgentOpen.push(t);
      if (!deadline) continue;
      const d = new Date(deadline);
      if (isTaskOverdueForAlert({ status, deadline, now })) overdue.push(t);
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

    const toLine = (t: (typeof open)[0]) => ({
      id: t.id as string,
      title: t.title as string,
      clientId: (t.client_id as string | null) ?? null,
    });
    const discordOk = await sendDiscordMorningDigest({
      employeeId: emp.id as string,
      fullName: emp.full_name as string,
      discordUserId: (emp.discord_user_id as string | null) ?? null,
      role: (emp.role as UserRole | null) ?? null,
      dueToday: dueToday.map(toLine),
      overdue: overdue.map(toLine),
      urgent: urgentOpen.map(toLine),
    });
    if (discordOk) discordDigestsSent += 1;

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
    discordDigestsSent,
    errors,
  };
}
