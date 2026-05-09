import { cronUnauthorizedResponse, verifyCronSecret } from '@/lib/cron/verify-cron-secret';
import { runDeadlineAlerts } from '@/lib/cron/run-deadline-alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return cronUnauthorizedResponse();
  const result = await runDeadlineAlerts();
  return Response.json({ ok: result.success, ...result });
}
