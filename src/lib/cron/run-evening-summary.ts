import 'server-only';

import { endOfDay, format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { createAdminClient } from '@/lib/supabase/admin';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { sendEmail } from '@/lib/email/send-email';
import { eveningSummarySubject, renderEveningSummaryEmail } from '@/lib/email/templates/evening-summary';
import { createNotificationOnce } from '@/lib/notifications/notify';
import { getCronEmailPrefs } from '@/lib/cron/user-notification-prefs';
import { fetchTaskIdsAssignedToEmployee } from '@/lib/data/task-assignments';
import {
  buildEveningDigestForEmployee,
  type EveningDigestLine,
  type EveningVideoRow,
} from '@/lib/cron/evening-summary-content';
import type { UserRole } from '@/types/database';

export type EveningSummaryResult = {
  success: boolean;
  employeesProcessed: number;
  notificationsCreated: number;
  emailsSent: number;
  emailsSkipped: number;
  errors: string[];
};

function digestToPlainMessage(d: ReturnType<typeof buildEveningDigestForEmployee>): string {
  const lines: string[] = [];
  if (d.overdue.length) lines.push(`En retard :\n${d.overdue.map((x) => `• ${x.text}`).join('\n')}`);
  if (d.tomorrow.length) lines.push(`Demain :\n${d.tomorrow.map((x) => `• ${x.text}`).join('\n')}`);
  if (d.watch.length) lines.push(`À surveiller :\n${d.watch.map((x) => `• ${x.text}`).join('\n')}`);
  if (d.finance.length) lines.push(`Finance :\n${d.finance.map((x) => `• ${x.text}`).join('\n')}`);
  if (!lines.length) lines.push('Aucune urgence critique listée pour demain.');
  return lines.join('\n\n');
}

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
  const base = appBaseUrl();

  const { data: employees, error: empErr } = await admin
    .from('employees')
    .select('id, user_id, full_name, email, is_active, role')
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

  const { data: vidRows } = await admin
    .from('videos')
    .select(
      'id, title, status, public_status, shooting_date, client_delivery_at, delivery_deadline, editor_id, cameraman_id, clients:client_id ( name )',
    )
    .not('status', 'in', '(archived,cancelled)')
    .limit(400);

  const vids = vidRows ?? [];
  const videoIds = vids.map((v) => v.id as string);
  const videoAssignByVideo = new Map<string, { employee_id: string; assignment_role: string }[]>();
  if (videoIds.length > 0) {
    const { data: vaRows, error: vaErr } = await admin
      .from('video_assignments')
      .select('video_id, employee_id, assignment_role')
      .in('video_id', videoIds);
    if (vaErr) errors.push(`video_assignments: ${vaErr.message}`);
    for (const r of vaRows ?? []) {
      const vid = r.video_id as string;
      if (!videoAssignByVideo.has(vid)) videoAssignByVideo.set(vid, []);
      videoAssignByVideo.get(vid)!.push({
        employee_id: r.employee_id as string,
        assignment_role: r.assignment_role as string,
      });
    }
  }

  const { count: overdueInvCount } = await admin
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'overdue');

  for (const emp of employees ?? []) {
    if (!emp.user_id) continue;

    const prefs = await getCronEmailPrefs(admin, emp.user_id);
    if (!prefs.evening_summary_enabled) {
      continue;
    }

    employeesProcessed += 1;

    const fromPivot = await fetchTaskIdsAssignedToEmployee(admin, emp.id as string);
    const taskOrParts = [`assignee_id.eq.${emp.id}`];
    if (fromPivot.length) taskOrParts.push(`id.in.(${fromPivot.join(',')})`);

    const { data: allAssigned } = await admin
      .from('tasks')
      .select('id,title,status,deadline,completed_at')
      .or(taskOrParts.join(','));

    const tasks = allAssigned ?? [];
    const completedToday = tasks.filter(
      (t) =>
        t.status === 'done' &&
        t.completed_at &&
        new Date(t.completed_at) >= dayStart &&
        new Date(t.completed_at) <= dayEnd,
    );

    const line = (t: (typeof tasks)[0]) =>
      t.deadline ? `${t.title} — ${format(new Date(t.deadline), 'HH:mm', { locale: fr })}` : t.title;

    const completedLines: EveningDigestLine[] = completedToday.map((t) => ({
      text: line(t),
      url: `${base}/tasks`,
    }));

    const digest = buildEveningDigestForEmployee({
      emp: {
        id: emp.id as string,
        full_name: emp.full_name as string,
        role: (emp.role ?? 'developer') as UserRole,
      },
      tasks: tasks as { id: string; title: string; status: string; deadline: string | null }[],
      videos: vids as EveningVideoRow[],
      videoAssignByVideo,
      overdueInvoiceCount: overdueInvCount ?? 0,
      now,
      baseUrl: base,
    });

    const message = digestToPlainMessage(digest);

    const notificationRow = {
      recipient_user_id: emp.user_id,
      type: 'evening_summary' as const,
      priority: digest.overdue.length > 0 ? ('high' as const) : ('normal' as const),
      title: 'Résumé de fin de journée',
      message,
      link_url: `${base}/dashboard`,
    };
    const { inserted } = await createNotificationOnce(notificationRow, {
      recipientUserId: emp.user_id,
      type: 'evening_summary',
      relatedEntityType: null,
      relatedEntityId: null,
      windowHours: 20,
    });
    if (inserted) notificationsCreated += 1;

    if (prefs.email_reminders_enabled) {
      const { html, text } = renderEveningSummaryEmail({
        digest,
        completedToday: completedLines,
        dashboardUrl: `${base}/dashboard`,
      });
      const r = await sendEmail({
        to: emp.email,
        subject: eveningSummarySubject({ digest }),
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
