import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import { canViewInvoices } from '@/lib/auth/capabilities';
import { resolveVisibleClientIds } from '@/lib/auth/data-scope';
import { syncInvoiceOverdueStatuses } from '@/lib/data/invoices';
import type { Invoice, InvoiceStatus, Payment } from '@/types/database';

export type PaymentWithInvoice = Payment & {
  invoices: { ref: string; id: string; status: Invoice['status']; total: number; currency: string } | null;
  clients: { name: string; id: string } | null;
};

export interface PaymentListFilters {
  clientId?: string | 'all';
  method?: Payment['method'] | 'all';
  from?: string;
  to?: string;
  search?: string;
  /** Filtre sur le statut de la facture liée */
  invoiceStatus?: InvoiceStatus | 'all';
}

export async function listPaymentsWithRelations(
  filters: PaymentListFilters = {},
  ctx: AuthContext | null = null
): Promise<PaymentWithInvoice[]> {
  const auth = ctx ?? (await getAuthContext());
  if (!auth || !canViewInvoices(auth.role)) return [];

  await syncInvoiceOverdueStatuses();
  const supabase = await createClient();
  const scope = await resolveVisibleClientIds(supabase, auth);
  if (scope !== 'all' && scope.length === 0) return [];

  let q = supabase
    .from('payments')
    .select('*, invoices(ref, id, status, total, currency), clients(name, id)')
    .order('payment_date', { ascending: false });

  if (scope !== 'all') q = q.in('client_id', scope);

  if (filters.clientId && filters.clientId !== 'all') q = q.eq('client_id', filters.clientId);
  if (filters.method && filters.method !== 'all') q = q.eq('method', filters.method);
  if (filters.from) q = q.gte('payment_date', filters.from);
  if (filters.to) q = q.lte('payment_date', filters.to);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  type Raw = Payment & {
    invoices: PaymentWithInvoice['invoices'] | PaymentWithInvoice['invoices'][] | null;
    clients: PaymentWithInvoice['clients'] | PaymentWithInvoice['clients'][] | null;
  };

  let rows: PaymentWithInvoice[] = (data ?? []).map((r) => {
    const row = r as Raw;
    return {
      ...row,
      invoices: Array.isArray(row.invoices) ? row.invoices[0] ?? null : row.invoices,
      clients: Array.isArray(row.clients) ? row.clients[0] ?? null : row.clients,
    };
  });

  const s = filters.search?.trim().toLowerCase();
  if (s) {
    rows = rows.filter(
      (p) =>
        (p.invoices?.ref?.toLowerCase().includes(s) ?? false) ||
        (p.clients?.name?.toLowerCase().includes(s) ?? false) ||
        (p.reference?.toLowerCase().includes(s) ?? false) ||
        (p.notes?.toLowerCase().includes(s) ?? false)
    );
  }

  if (filters.invoiceStatus && filters.invoiceStatus !== 'all') {
    rows = rows.filter((p) => p.invoices?.status === filters.invoiceStatus);
  }

  return rows;
}

export type PaymentDashboardStats = {
  collected_this_month: number;
  payments_count_month: number;
  pending_invoices_amount: number;
  overdue_invoices_amount: number;
  currency: string;
};

export async function getPaymentDashboardStats(
  ctx: AuthContext | null = null
): Promise<PaymentDashboardStats> {
  const auth = ctx ?? (await getAuthContext());
  if (!auth || !canViewInvoices(auth.role)) {
    return {
      collected_this_month: 0,
      payments_count_month: 0,
      pending_invoices_amount: 0,
      overdue_invoices_amount: 0,
      currency: 'MAD',
    };
  }

  await syncInvoiceOverdueStatuses();
  const supabase = await createClient();
  const scope = await resolveVisibleClientIds(supabase, auth);
  if (scope !== 'all' && scope.length === 0) {
    return {
      collected_this_month: 0,
      payments_count_month: 0,
      pending_invoices_amount: 0,
      overdue_invoices_amount: 0,
      currency: 'MAD',
    };
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const start = `${y}-${m}-01`;
  const endDate = new Date(y, now.getMonth() + 1, 0);
  const end = endDate.toISOString().slice(0, 10);

  let payQ = supabase.from('payments').select('amount, currency').gte('payment_date', start).lte('payment_date', end);
  let invQ = supabase.from('invoices').select('total, currency, status, due_date, client_id');
  if (scope !== 'all') {
    payQ = payQ.in('client_id', scope);
    invQ = invQ.in('client_id', scope);
  }

  const [{ data: paymentsMonth }, { data: invoices }] = await Promise.all([payQ, invQ]);

  let collected = 0;
  let currency = 'MAD';
  for (const p of paymentsMonth ?? []) {
    collected += Number((p as { amount: number }).amount);
    currency = (p as { currency: string }).currency || currency;
  }

  const today = now.toISOString().slice(0, 10);
  let pending = 0;
  let overdue = 0;
  for (const inv of invoices ?? []) {
    const row = inv as Invoice;
    if (row.status === 'paid' || row.status === 'cancelled' || row.status === 'draft') continue;
    currency = row.currency || currency;
    const amt = Number(row.total);
    const isOverdue = row.status === 'overdue' || row.due_date < today;
    if (isOverdue) overdue += amt;
    else pending += amt;
  }

  return {
    collected_this_month: collected,
    payments_count_month: paymentsMonth?.length ?? 0,
    pending_invoices_amount: pending,
    overdue_invoices_amount: overdue,
    currency,
  };
}
