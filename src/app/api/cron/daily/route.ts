import { cronUnauthorizedResponse, verifyCronSecret } from '@/lib/cron/verify-cron-secret';
import { runMorningReminders } from '@/lib/cron/run-morning-reminders';
import { runOverdueInvoices } from '@/lib/cron/run-overdue-invoices';
import { runDeadlineAlerts } from '@/lib/cron/run-deadline-alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily cron: overdue invoices → deadline alerts → morning reminders
 * (in-app/email + Discord operational reminders when enabled).
 * Scheduled every day (including weekend shoots) at 07:30 UTC.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return cronUnauthorizedResponse();

  const overdueInvoices = await runOverdueInvoices();
  const deadlineAlerts = await runDeadlineAlerts();
  const morningReminders = await runMorningReminders();

  const ok = overdueInvoices.success && deadlineAlerts.success && morningReminders.success;

  return Response.json({
    ok,
    overdueInvoices,
    deadlineAlerts,
    morningReminders,
  });
}
