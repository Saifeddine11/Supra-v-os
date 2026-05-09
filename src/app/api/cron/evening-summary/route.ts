import { cronUnauthorizedResponse, verifyCronSecret } from '@/lib/cron/verify-cron-secret';
import { runEveningSummary } from '@/lib/cron/run-evening-summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return cronUnauthorizedResponse();
  const result = await runEveningSummary();
  return Response.json({ ok: result.success, ...result });
}
