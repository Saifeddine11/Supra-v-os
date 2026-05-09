import { cronUnauthorizedResponse, verifyCronSecret } from '@/lib/cron/verify-cron-secret';
import { runOverdueInvoices } from '@/lib/cron/run-overdue-invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return cronUnauthorizedResponse();
  const result = await runOverdueInvoices();
  return Response.json({ ok: result.success, ...result });
}
