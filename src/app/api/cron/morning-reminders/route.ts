import { cronUnauthorizedResponse, verifyCronSecret } from '@/lib/cron/verify-cron-secret';
import { runMorningReminders } from '@/lib/cron/run-morning-reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return cronUnauthorizedResponse();
  const result = await runMorningReminders();
  return Response.json({ ok: result.success, ...result });
}
