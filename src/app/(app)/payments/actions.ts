'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManagePayments } from '@/lib/auth/capabilities';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { Invoice, PaymentMethod } from '@/types/database';
import { syncInvoiceOverdueStatuses } from '@/lib/data/invoices';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { assertInvoiceRecordVisible } from '@/lib/auth/data-scope';

export async function createPaymentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canManagePayments(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const invoice_id = String(formData.get('invoice_id') ?? '').trim();
  if (!invoice_id) return actionError('Facture requise.');
  const client_id = String(formData.get('client_id') ?? '').trim();
  if (!client_id) return actionError('Client requis.');

  const amount = Number(formData.get('amount'));
  if (!Number.isFinite(amount) || amount <= 0) return actionError('Montant invalide.');

  const method = String(formData.get('method') ?? 'bank_transfer') as PaymentMethod;
  const payment_date = String(formData.get('payment_date') ?? new Date().toISOString().slice(0, 10));
  const currency = String(formData.get('currency') ?? 'MAD').trim() || 'MAD';
  const reference = String(formData.get('reference') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  const { data: inv, error: e0 } = await supabase
    .from('invoices')
    .select('id, total, client_id, status')
    .eq('id', invoice_id)
    .single();
  if (e0 || !inv) return actionError('Facture introuvable.');
  const invClient = (inv as { client_id: string }).client_id;
  if (invClient !== client_id) {
    return actionError('Le client ne correspond pas à la facture.');
  }
  if (!(await assertInvoiceRecordVisible(supabase, ctx, invClient))) {
    return actionError('Facture inaccessible.');
  }

  const { data: inserted, error } = await supabase
    .from('payments')
    .insert({
      invoice_id,
      client_id,
      amount,
      currency,
      method,
      payment_date,
      reference,
      notes,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) return actionError(getPostgrestError(error));
  if (!inserted?.id) return actionError('Paiement non enregistré.');

  const { data: allPay } = await supabase.from('payments').select('amount').eq('invoice_id', invoice_id);
  const paidSum = (allPay ?? []).reduce((s, p) => s + Number((p as { amount: number }).amount), 0);
  const total = Number((inv as { total: number }).total);
  if (paidSum >= total - 0.009) {
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice_id);
  }

  await syncInvoiceOverdueStatuses();

  await logStaffActivity(ctx, {
    action: 'created',
    entityType: 'payment',
    entityId: inserted.id,
    metadata: { invoice_id, amount, client_id },
  });

  revalidatePath('/payments');
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${invoice_id}`);
  revalidatePath('/dashboard');
  return actionOk({ id: inserted.id });
}

async function syncInvoicePaidState(invoiceId: string) {
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from('invoices')
    .select('total, due_date, status')
    .eq('id', invoiceId)
    .single();
  if (!inv) return;
  const row = inv as Pick<Invoice, 'total' | 'due_date' | 'status'>;
  if (row.status === 'cancelled') return;

  const { data: pays } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId);
  const paidSum = (pays ?? []).reduce((s, p) => s + Number((p as { amount: number }).amount), 0);
  const total = Number(row.total);
  const today = new Date().toISOString().slice(0, 10);

  if (paidSum >= total - 0.009) {
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);
    return;
  }

  if (row.status === 'draft') {
    await supabase
      .from('invoices')
      .update({ paid_at: null, updated_at: new Date().toISOString() })
      .eq('id', invoiceId);
    return;
  }

  const nextStatus = row.due_date < today ? 'overdue' : row.status === 'sent' ? 'sent' : 'pending';
  await supabase
    .from('invoices')
    .update({
      status: nextStatus,
      paid_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);
}

export async function deletePaymentAction(paymentId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canManagePayments(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const { data: pay, error: e0 } = await supabase
    .from('payments')
    .select('id, invoice_id, client_id')
    .eq('id', paymentId)
    .single();
  if (e0 || !pay) return actionError('Paiement introuvable.');
  const invoiceId = (pay as { invoice_id: string }).invoice_id;
  let clientIdForScope = (pay as { client_id: string | null }).client_id;
  if (!clientIdForScope) {
    const { data: inv } = await supabase.from('invoices').select('client_id').eq('id', invoiceId).maybeSingle();
    clientIdForScope = inv?.client_id ?? null;
  }
  if (!clientIdForScope || !(await assertInvoiceRecordVisible(supabase, ctx, clientIdForScope))) {
    return actionError('Paiement inaccessible.');
  }

  const { error } = await supabase.from('payments').delete().eq('id', paymentId);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'deleted',
    entityType: 'payment',
    entityId: paymentId,
    metadata: { invoice_id: invoiceId },
  });

  await syncInvoicePaidState(invoiceId);
  await syncInvoiceOverdueStatuses();
  revalidatePath('/payments');
  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  return actionOk();
}
