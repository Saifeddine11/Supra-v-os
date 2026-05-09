import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import { canViewInvoices } from '@/lib/auth/capabilities';
import { assertInvoiceRecordVisible, resolveVisibleClientIds } from '@/lib/auth/data-scope';
import type { Invoice, InvoiceItem } from '@/types/database';

export type InvoiceWithClient = Invoice & { clients: { name: string; id: string } | null };

export async function syncInvoiceOverdueStatuses(): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx || !canViewInvoices(ctx.role)) return;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from('invoices')
    .update({ status: 'overdue', updated_at: new Date().toISOString() })
    .in('status', ['pending', 'sent'])
    .lt('due_date', today);
}

export async function listInvoicesWithClients(
  ctx: AuthContext | null = null
): Promise<InvoiceWithClient[]> {
  await syncInvoiceOverdueStatuses();
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role || !canViewInvoices(auth.role)) return [];

  const scope = await resolveVisibleClientIds(supabase, auth);
  if (scope !== 'all' && scope.length === 0) return [];

  let q = supabase.from('invoices').select('*, clients(name, id)').order('issue_date', { ascending: false });
  if (scope !== 'all') q = q.in('client_id', scope);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as InvoiceWithClient[];
}

export async function getInvoiceWithItems(
  id: string,
  ctx: AuthContext | null = null
): Promise<{
  invoice: InvoiceWithClient | null;
  items: InvoiceItem[];
}> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  const { data: inv, error: e1 } = await supabase
    .from('invoices')
    .select('*, clients(name, id)')
    .eq('id', id)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!inv || !auth?.role) {
    return { invoice: null, items: [] };
  }

  if (!(await assertInvoiceRecordVisible(supabase, auth, inv.client_id))) {
    return { invoice: null, items: [] };
  }

  const { data: items, error: e2 } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .order('position');
  if (e2) throw new Error(e2.message);
  return {
    invoice: inv as InvoiceWithClient,
    items: items ?? [],
  };
}
