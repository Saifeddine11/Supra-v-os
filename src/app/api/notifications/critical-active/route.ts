import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import type { ServiceRoleClient } from '@/lib/supabase/admin';
import {
  fetchCriticalAlertsWithClient,
  mapCriticalAlertsToActiveApi,
} from '@/lib/data/critical-alerts';

export const dynamic = 'force-dynamic';

/**
 * Alertes actives basées sur l’état métier (retards, livraisons, etc.) — pas sur is_read.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx?.userId || !ctx.employee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const items = await fetchCriticalAlertsWithClient(supabase as unknown as ServiceRoleClient, ctx);
    return NextResponse.json(mapCriticalAlertsToActiveApi(items));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
