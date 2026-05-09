import 'server-only';

/**
 * Validates Vercel / external cron requests.
 * Accepts: Authorization: Bearer <CRON_SECRET> or x-cron-secret: <CRON_SECRET>
 */
export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.warn('[cron] CRON_SECRET is not set — rejecting cron request.');
    return false;
  }

  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token === secret) return true;
  }

  const header = request.headers.get('x-cron-secret');
  if (header?.trim() === secret) return true;

  return false;
}

export function cronUnauthorizedResponse() {
  return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
}
