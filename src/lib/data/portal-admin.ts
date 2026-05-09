import { createClient } from '@/lib/supabase/server';
import type { Client, ClientPortal } from '@/types/database';

export type PortalAdminListRow = {
  client: Pick<Client, 'id' | 'name' | 'status' | 'email'>;
  portal: ClientPortal | null;
  visible_quotes: number;
  visible_documents: number;
  visible_reports: number;
  pending_validations: number;
};

function countByClient<T extends { client_id: string }>(rows: T[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.client_id, (m.get(r.client_id) ?? 0) + 1);
  }
  return m;
}

export interface PortalAdminFilters {
  search?: string;
  state?: 'all' | 'active' | 'inactive' | 'missing_token';
}

export async function listPortalAdminRows(filters: PortalAdminFilters = {}): Promise<PortalAdminListRow[]> {
  const supabase = await createClient();
  const { data: clients, error: e1 } = await supabase
    .from('clients')
    .select('id, name, status, email')
    .order('name');
  if (e1) throw new Error(e1.message);
  const clientRows = (clients ?? []) as PortalAdminListRow['client'][];
  if (clientRows.length === 0) return [];

  const clientIds = clientRows.map((c) => c.id);

  const [portalsRes, quotesRes, docsRes, repRes, vidRes] = await Promise.all([
    supabase.from('client_portals').select('*').in('client_id', clientIds),
    supabase.from('quotes').select('client_id').eq('visible_to_client', true).in('client_id', clientIds),
    supabase.from('documents').select('client_id').eq('visible_to_client', true).in('client_id', clientIds),
    supabase.from('reports').select('client_id').eq('visible_to_client', true).in('client_id', clientIds),
    supabase
      .from('videos')
      .select('client_id')
      .in('client_id', clientIds)
      .in('status', ['sent_to_client', 'client_revision']),
  ]);

  const portalByClient = new Map<string, ClientPortal>();
  for (const p of portalsRes.data ?? []) {
    portalByClient.set((p as ClientPortal).client_id, p as ClientPortal);
  }

  const qCount = countByClient((quotesRes.data ?? []) as { client_id: string }[]);
  const dCount = countByClient((docsRes.data ?? []) as { client_id: string }[]);
  const rCount = countByClient((repRes.data ?? []) as { client_id: string }[]);
  const vCount = countByClient((vidRes.data ?? []) as { client_id: string }[]);

  let rows: PortalAdminListRow[] = clientRows.map((c) => ({
    client: c,
    portal: portalByClient.get(c.id) ?? null,
    visible_quotes: qCount.get(c.id) ?? 0,
    visible_documents: dCount.get(c.id) ?? 0,
    visible_reports: rCount.get(c.id) ?? 0,
    pending_validations: vCount.get(c.id) ?? 0,
  }));

  const s = filters.search?.trim().toLowerCase();
  if (s) {
    rows = rows.filter((r) => r.client.name.toLowerCase().includes(s) || (r.client.email?.toLowerCase().includes(s) ?? false));
  }

  if (filters.state && filters.state !== 'all') {
    rows = rows.filter((r) => {
      const hasToken = Boolean(r.portal?.token);
      const active = r.portal?.is_active ?? false;
      if (filters.state === 'active') return hasToken && active;
      if (filters.state === 'inactive') return hasToken && !active;
      if (filters.state === 'missing_token') return !hasToken;
      return true;
    });
  }

  return rows;
}
