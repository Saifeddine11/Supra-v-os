import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchCriticalAlertsWithClient } from '@/lib/data/critical-alerts';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';
import type { AuthContext } from '@/lib/auth/permissions';
import type { Employee } from '@/types/database';
import { perfMs } from '@/lib/perf/dev-time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function probeAllowed(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.PERF_LOGIN_LOGS === '1';
}

/**
 * Diagnosis-only: Auth/network RTT + heavy query timings.
 * Never enabled on production unless PERF_LOGIN_LOGS=1. Does not return row data.
 */
export async function GET() {
  if (!probeAllowed()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'missing supabase env' }, { status: 500 });
  }

  const timings: Record<string, number | string | null> = {
    supabaseHost: new URL(url).hostname,
  };

  const healthStart = performance.now();
  try {
    const health = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      cache: 'no-store',
    });
    timings.authHealthMs = perfMs(healthStart);
    timings.authHealthStatus = health.status;
  } catch (e) {
    timings.authHealthMs = perfMs(healthStart);
    timings.authHealthError = e instanceof Error ? e.message : 'fetch failed';
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signStart = performance.now();
  await anon.auth.signInWithPassword({
    email: 'login-perf-probe@invalid.example',
    password: 'invalid-login-perf-probe',
  });
  timings.signInWithPasswordInvalidMs = perfMs(signStart);

  try {
    const admin = createAdminClient();
    const dbStart = performance.now();
    const { data: emp, error } = await admin
      .from('employees')
      .select('id, user_id, role, full_name, is_active')
      .eq('is_active', true)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();
    timings.employeeLookupMs = perfMs(dbStart);
    if (error) {
      timings.employeeLookupError = error.message;
    } else if (emp?.user_id) {
      const ctx: AuthContext = {
        userId: emp.user_id as string,
        email: '',
        employee: emp as Employee,
        role: (emp as Employee).role,
      };
      const alertStart = performance.now();
      const bundle = await fetchCriticalAlertsWithClient(admin, ctx);
      timings.criticalAlertsMs = perfMs(alertStart);
      timings.criticalAlertCount = bundle.allActionItems.length;

      const notifStart = performance.now();
      await Promise.all([
        admin.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
        admin.from('notifications').select('id').eq('is_read', false).order('created_at', { ascending: false }).limit(8),
        admin.from('notifications').select('id').order('created_at', { ascending: false }).limit(8),
      ]);
      timings.layoutNotificationsMs = perfMs(notifStart);

      const statsStart = performance.now();
      await Promise.all([
        admin.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        admin.from('tasks').select('id', { count: 'exact', head: true }),
        admin.from('videos').select('id', { count: 'exact', head: true }),
        admin.from('projects').select('id', { count: 'exact', head: true }),
        admin.from('invoices').select('id', { count: 'exact', head: true }),
      ]);
      timings.dashboardCountQueriesMs = perfMs(statsStart);
    }
  } catch (e) {
    timings.adminProbeError = e instanceof Error ? e.message : 'admin probe failed';
  }

  return NextResponse.json({ ok: true, timings });
}
