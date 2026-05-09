import { cronUnauthorizedResponse, verifyCronSecret } from '@/lib/cron/verify-cron-secret';
import { runMorningReminders } from '@/lib/cron/run-morning-reminders';
import { runOverdueInvoices } from '@/lib/cron/run-overdue-invoices';
import { runDeadlineAlerts } from '@/lib/cron/run-deadline-alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hobby-friendly single cron: runs overdue invoices → deadline alerts → morning reminders.
 * Individual routes under `/api/cron/*` remain for manual tests or Vercel Pro schedules.
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
