'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canModifyInvoices, canViewInvoices } from '@/lib/auth/capabilities';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { InvoiceStatus } from '@/types/database';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { notifyFinanceTeam } from '@/lib/notifications/notify';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { assertInvoiceRecordVisible } from '@/lib/auth/data-scope';

function computeTotals(
  lines: { quantity: number; unit_price: number }[],
  taxRatePct: number,
  discount: number
) {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const tax_amount = Math.round(subtotal * (taxRatePct / 100) * 100) / 100;
  const total = Math.round((subtotal + tax_amount - discount) * 100) / 100;
  return { subtotal, tax_amount, total };
}

export async function createInvoiceAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyInvoices(ctx.role)) {
    return actionError('Seuls l’administrateur et le commercial peuvent créer une facture.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const clientId = String(formData.get('client_id') ?? '').trim();
  if (!clientId) return actionError('Le client est requis.');
  if (!(await assertInvoiceRecordVisible(supabase, ctx, clientId))) {
    return actionError('Ce client est hors de votre périmètre pour une facture.');
  }

  const desc = String(formData.get('line_description') ?? '').trim() || 'Prestation';
  const qty = Number(formData.get('line_quantity') ?? 1) || 1;
  const unit = Number(formData.get('line_unit_price') ?? 0) || 0;
  if (unit <= 0) return actionError('Le prix unitaire doit être positif.');

  const taxRate = Number(formData.get('tax_rate') ?? 0) || 0;
  const discount = Number(formData.get('discount') ?? 0) || 0;
  const dueRaw = String(formData.get('due_date') ?? '').trim();
  if (!dueRaw) return actionError('La date d’échéance est requise.');

  const { data: refData, error: refErr } = await supabase.rpc('next_invoice_ref');
  if (refErr || !refData) return actionError(refErr ? getPostgrestError(refErr) : 'Référence facture indisponible.');

  const ref = refData as string;
  const lines = [{ quantity: qty, unit_price: unit }];
  const { subtotal, tax_amount, total } = computeTotals(lines, taxRate, discount);

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .insert({
      client_id: clientId,
      ref,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: dueRaw,
      status: 'draft' as InvoiceStatus,
      subtotal,
      tax_rate: taxRate,
      tax_amount,
      discount,
      total,
      currency: String(formData.get('currency') ?? 'MAD').trim() || 'MAD',
      notes: String(formData.get('notes') ?? '').trim() || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (invErr || !inv) return actionError(invErr ? getPostgrestError(invErr) : 'Échec création facture.');

  const lineTotal = Math.round(qty * unit * 100) / 100;
  const { error: liErr } = await supabase.from('invoice_items').insert({
    invoice_id: inv.id,
    position: 0,
    description: desc,
    quantity: qty,
    unit: String(formData.get('line_unit') ?? '').trim() || null,
    unit_price: unit,
    total: lineTotal,
  });

  if (liErr) {
    await supabase.from('invoices').delete().eq('id', inv.id);
    return actionError(getPostgrestError(liErr));
  }

  await logStaffActivity(ctx, {
    action: 'created',
    entityType: 'invoice',
    entityId: inv.id,
    metadata: { ref, client_id: clientId },
  });

  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  revalidatePath(`/clients/${clientId}`);
  return actionOk({ id: inv.id });
}

export async function updateInvoiceStatusAction(id: string, status: InvoiceStatus): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyInvoices(ctx.role)) {
    return actionError('Droits insuffisants.');
  }

  const supabase = await createClient();
  const { data: invRow } = await supabase.from('invoices').select('client_id').eq('id', id).maybeSingle();
  if (!invRow || !(await assertInvoiceRecordVisible(supabase, ctx, invRow.client_id))) {
    return actionError('Facture inaccessible.');
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'sent') patch.sent_at = new Date().toISOString();

  const { error } = await supabase.from('invoices').update(patch).eq('id', id);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'invoice',
    entityId: id,
    metadata: { status },
  });

  if (status === 'sent') {
    const { data: inv } = await supabase.from('invoices').select('ref').eq('id', id).maybeSingle();
    if (inv) {
      const base = appBaseUrl();
      await notifyFinanceTeam({
        type: 'invoice_sent',
        priority: 'normal',
        title: 'Facture envoyée',
        message: inv.ref,
        relatedEntityType: 'invoice',
        relatedEntityId: id,
        linkUrl: `${base}/invoices`,
      });
    }
  }

  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  return actionOk();
}

export async function markInvoicePaidAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyInvoices(ctx.role)) {
    return actionError('Droits insuffisants.');
  }

  const supabase = await createClient();
  const { data: invRow } = await supabase.from('invoices').select('client_id').eq('id', id).maybeSingle();
  if (!invRow || !(await assertInvoiceRecordVisible(supabase, ctx, invRow.client_id))) {
    return actionError('Facture inaccessible.');
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'paid' as InvoiceStatus,
      paid_at: now,
      updated_at: now,
    })
    .eq('id', id);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'invoice',
    entityId: id,
    metadata: { status: 'paid' },
  });

  const { data: inv } = await supabase.from('invoices').select('ref,total,currency').eq('id', id).maybeSingle();
  if (inv) {
    const base = appBaseUrl();
    await notifyFinanceTeam({
      type: 'invoice_paid',
      priority: 'normal',
      title: 'Facture payée',
      message: `${inv.ref} — ${inv.total} ${inv.currency}`,
      relatedEntityType: 'invoice',
      relatedEntityId: id,
      linkUrl: `${base}/invoices`,
    });
  }

  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  return actionOk();
}

export async function deleteInvoiceAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyInvoices(ctx.role)) {
    return actionError('Droits insuffisants.');
  }

  const supabase = await createClient();
  const { data: inv } = await supabase.from('invoices').select('ref, client_id').eq('id', id).maybeSingle();
  if (!inv || !(await assertInvoiceRecordVisible(supabase, ctx, inv.client_id))) {
    return actionError('Facture inaccessible.');
  }
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'deleted',
    entityType: 'invoice',
    entityId: id,
    metadata: { ref: inv?.ref },
  });

  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  return actionOk();
}

export async function refreshInvoiceOverdueAction(): Promise<ActionResult> {
  const ctx = await getAuthContext();
  /** Pas de recalcul global pour les rôles sans responsabilité ops / finance (ex. commercial en lecture). */
  if (!ctx || !['admin', 'finance', 'project_manager'].includes(ctx.role ?? '')) {
    return actionOk();
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from('invoices')
    .update({ status: 'overdue', updated_at: new Date().toISOString() })
    .in('status', ['pending', 'sent'])
    .lt('due_date', today);

  revalidatePath('/invoices');
  return actionOk();
}
