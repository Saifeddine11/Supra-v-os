import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchCriticalAlertsWithClient,
  mapCriticalAlertsToActiveApi,
} from '@/lib/data/critical-alerts';

export const dynamic = 'force-dynamic';

/**
 * Alertes actives basées sur l’état métier (retards, livraisons, etc.) — pas sur is_read.
 *
 * Client **service role** après contrôle `getAuthContext` : les requêtes appliquent le
 * périmètre métier dans `fetchCriticalAlertsWithClient` (assignations, rôle, etc.). La RLS
 * session ne doit pas masquer des lignes que le dashboard compte déjà via les mêmes règles.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx?.userId || !ctx.employee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const items = await fetchCriticalAlertsWithClient(admin, ctx);
    const body = mapCriticalAlertsToActiveApi(items);

    if (process.env.NODE_ENV === 'development') {
      console.log('[critical-active] user', ctx.employee.id, ctx.role);
      console.log('[critical-active] alerts', body.alerts.length, 'critical', body.criticalCount);
    }

    const headers = new Headers();
    const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
    if (sha) headers.set('x-deploy-commit', sha);

    return NextResponse.json(body, { headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
