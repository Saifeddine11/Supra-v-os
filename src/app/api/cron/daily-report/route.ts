import { cronUnauthorizedResponse, verifyCronSecret } from '@/lib/cron/verify-cron-secret';
import { runDiscordDailyReportReminders } from '@/lib/discord/daily-report-reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/daily-report — GitHub Actions (15 min, 16–18 UTC) or manual CRON_SECRET.
 * Posts 18:00 / 18:30 Africa/Casablanca compte-rendu messages when the flag is on.
 * Not scheduled in vercel.json (Hobby cannot hit both times reliably).
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return cronUnauthorizedResponse();
  const result = await runDiscordDailyReportReminders();
  return Response.json({ ok: result.errors.length === 0, ...result });
}
