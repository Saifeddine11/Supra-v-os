import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import { assertReportRecordVisible } from '@/lib/auth/data-scope';
import type { Report } from '@/types/database';

export type ReportWithClient = Report & { clients: { name: string; id: string } | null };

export async function listReportsWithClients(
  ctx: AuthContext | null = null
): Promise<ReportWithClient[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role) return [];

  const { data, error } = await supabase
    .from('reports')
    .select('*, clients(name, id)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ReportWithClient[];
  const out: ReportWithClient[] = [];
  for (const r of rows) {
    if (
      await assertReportRecordVisible(supabase, auth, {
        client_id: r.client_id,
        type: r.type,
      })
    ) {
      out.push(r);
    }
  }
  return out;
}

export async function getReportById(
  id: string,
  ctx: AuthContext | null = null
): Promise<ReportWithClient | null> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reports')
    .select('*, clients(name, id)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !auth?.role) return null;

  const row = data as ReportWithClient;
  if (
    !(await assertReportRecordVisible(supabase, auth, {
      client_id: row.client_id,
      type: row.type,
    }))
  ) {
    return null;
  }
  return row;
}
