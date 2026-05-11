import { cronUnauthorizedResponse, verifyCronSecret } from '@/lib/cron/verify-cron-secret';
import { runCriticalAlertsReminders } from '@/lib/cron/run-critical-alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/critical-alerts — Vercel Cron ou appel manuel avec CRON_SECRET.
 * Rappels digest toutes les 2h max par utilisateur (fenêtre createNotificationOnce).
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return cronUnauthorizedResponse();
  const result = await runCriticalAlertsReminders();
  return Response.json({ ok: result.success, ...result });
}
