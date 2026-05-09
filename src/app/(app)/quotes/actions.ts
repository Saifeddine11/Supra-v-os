'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canModifyQuotes } from '@/lib/auth/capabilities';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { InvoiceStatus, QuoteDiscountMode, QuoteStatus, QuoteStrategicBlock } from '@/types/database';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { notifyFinanceTeam } from '@/lib/notifications/notify';
import { getQuotePreset } from '@/data/quote-presets';
import { normalizeStrategicBlocks } from '@/lib/quotes/normalize';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { assertInvoiceRecordVisible, assertQuoteRecordVisible } from '@/lib/auth/data-scope';

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

type LinePayload = {
  service_name: string;
  description: string;
  detail_text: string | null;
  quantity: number;
  unit_price: number;
  unit: string | null;
  is_optional: boolean;
  is_recommended: boolean;
  strategic_explanation: string | null;
};

function parseStrategicBlocksJson(raw: string | null | undefined): QuoteStrategicBlock[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeStrategicBlocks(parsed);
  } catch {
    return [];
  }
}

function parseLinesJson(raw: string): LinePayload[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map((l: Record<string, unknown>) => {
      const serviceName = String(l.service_name ?? '').trim();
      const desc = String(l.description ?? '').trim();
      const name = serviceName || desc || 'Prestation';
      return {
        service_name: name,
        description: desc || name,
        detail_text: l.detail_text != null ? String(l.detail_text).trim() || null : null,
        quantity: Number(l.quantity) || 1,
        unit_price: Number(l.unit_price) || 0,
        unit: l.unit != null ? String(l.unit).trim() || null : null,
        is_optional: l.is_optional === true,
        is_recommended: l.is_recommended === true,
        strategic_explanation:
          l.strategic_explanation != null ? String(l.strategic_explanation).trim() || null : null,
      };
    });
  } catch {
    return null;
  }
}

function linesPricingOk(lines: LinePayload[]) {
  return !lines.some((l) => !l.is_optional && l.unit_price <= 0);
}

function resolveDiscountAmount(
  mode: QuoteDiscountMode,
  fixed: number,
  percent: number,
  subtotal: number,
  tax_amount: number
) {
  if (mode === 'percent' && percent > 0) {
    return Math.round((subtotal + tax_amount) * (percent / 100) * 100) / 100;
  }
  return fixed;
}

function invoiceDescriptionFromQuoteItem(line: {
  service_name?: string | null;
  description: string;
  detail_text?: string | null;
}) {
  const name = (line.service_name ?? '').trim() || line.description;
  const det = (line.detail_text ?? '').trim();
  if (det) return `${name} — ${det}`;
  return name;
}

export async function createQuoteAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyQuotes(ctx.role)) {
    return actionError('Seuls l’administrateur et le commercial peuvent créer un devis.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const clientId = String(formData.get('client_id') ?? '').trim();
  if (!clientId) return actionError('Le client est requis.');
  if (!(await assertQuoteRecordVisible(supabase, ctx, clientId))) {
    return actionError('Ce client est hors de votre périmètre pour un devis.');
  }

  const taxRate = Number(formData.get('tax_rate') ?? 0) || 0;
  const validUntil = String(formData.get('valid_until') ?? '').trim();
  if (!validUntil) return actionError('La date de validité est requise.');

  const presetKey = String(formData.get('preset_key') ?? '').trim();
  const preset = presetKey ? getQuotePreset(presetKey) : undefined;

  const linesRaw = String(formData.get('lines_json') ?? '').trim();
  let lines: LinePayload[];

  if (linesRaw) {
    const parsed = parseLinesJson(linesRaw);
    if (!parsed) return actionError('Lignes invalides.');
    lines = parsed;
  } else if (preset) {
    lines = preset.lines.map((l) => ({
      service_name: l.service_name,
      description: l.service_name,
      detail_text: l.detail_text || null,
      quantity: l.quantity,
      unit_price: l.unit_price,
      unit: l.unit,
      is_optional: l.is_optional,
      is_recommended: l.is_recommended,
      strategic_explanation: l.strategic_explanation || null,
    }));
  } else {
    const desc = String(formData.get('line_description') ?? '').trim() || 'Prestation';
    const qty = Number(formData.get('line_quantity') ?? 1) || 1;
    const unitP = Number(formData.get('line_unit_price') ?? 0) || 0;
    if (unitP <= 0) return actionError('Le prix unitaire doit être positif.');
    lines = [
      {
        service_name: desc,
        description: desc,
        detail_text: null,
        quantity: qty,
        unit_price: unitP,
        unit: String(formData.get('line_unit') ?? '').trim() || null,
        is_optional: false,
        is_recommended: false,
        strategic_explanation: null,
      },
    ];
  }

  if (lines.some((l) => l.quantity <= 0)) {
    return actionError('Chaque ligne doit avoir une quantité positive.');
  }

  const discountMode = (String(formData.get('discount_mode') ?? 'fixed') === 'percent'
    ? 'percent'
    : 'fixed') as QuoteDiscountMode;
  const discountFixed = Number(formData.get('discount') ?? 0) || 0;
  const discountPct = Number(formData.get('discount_percent') ?? '') || 0;

  const subPre = lines.map((l) => ({ quantity: l.quantity, unit_price: l.unit_price }));
  const { subtotal, tax_amount } = computeTotals(subPre, taxRate, 0);
  const discount = resolveDiscountAmount(discountMode, discountFixed, discountPct, subtotal, tax_amount);
  const { total } = computeTotals(subPre, taxRate, discount);

  const strategicBlocks = parseStrategicBlocksJson(String(formData.get('strategic_blocks_json') ?? ''));
  const blocks =
    strategicBlocks.length > 0
      ? strategicBlocks
      : preset?.strategic_value_blocks ?? [];

  const proposalTitle =
    String(formData.get('proposal_title') ?? '').trim() || preset?.proposal_title || null;
  const packageName = String(formData.get('package_name') ?? '').trim() || preset?.package_name || null;
  const projectObject = String(formData.get('project_object') ?? '').trim() || preset?.project_object || null;
  const strategicPositioning =
    String(formData.get('strategic_positioning') ?? '').trim() || preset?.strategic_positioning || null;
  const conditions = String(formData.get('conditions') ?? '').trim() || preset?.conditions || null;
  const executionAssumptions =
    String(formData.get('execution_assumptions') ?? '').trim() || preset?.execution_assumptions || null;
  const commercialRecommendation =
    String(formData.get('commercial_recommendation') ?? '').trim() || preset?.commercial_recommendation || null;
  const promotionalLabel = String(formData.get('promotional_label') ?? '').trim() || preset?.promotional_label || null;
  const promotionalTerms = String(formData.get('promotional_terms') ?? '').trim() || preset?.promotional_terms || null;
  const adsBudgetNote = String(formData.get('ads_budget_note') ?? '').trim() || preset?.ads_budget_note || null;
  const maintenanceNote = String(formData.get('maintenance_note') ?? '').trim() || preset?.maintenance_note || null;
  const revisionPolicyNote =
    String(formData.get('revision_policy_note') ?? '').trim() || preset?.revision_policy_note || null;
  const paymentTerms = String(formData.get('payment_terms') ?? '').trim() || preset?.payment_terms || null;
  const template = String(formData.get('template') ?? '').trim() || 'supra_premium_black_orange';

  const firstMonthRaw = String(formData.get('first_month_total') ?? '').trim();
  const recurringRaw = String(formData.get('recurring_monthly_total') ?? '').trim();
  const commitmentRaw = String(formData.get('commitment_months') ?? '').trim();

  const { data: refData, error: refErr } = await supabase.rpc('next_quote_ref');
  if (refErr || !refData) return actionError(refErr ? getPostgrestError(refErr) : 'Référence devis indisponible.');

  const ref = refData as string;

  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .insert({
      client_id: clientId,
      ref,
      issue_date: new Date().toISOString().slice(0, 10),
      valid_until: validUntil,
      status: 'draft' as QuoteStatus,
      subtotal,
      tax_rate: taxRate,
      tax_amount,
      discount,
      total,
      currency: String(formData.get('currency') ?? 'MAD').trim() || 'MAD',
      notes: String(formData.get('notes') ?? '').trim() || null,
      conditions,
      template,
      proposal_title: proposalTitle,
      package_name: packageName,
      project_object: projectObject,
      strategic_positioning: strategicPositioning,
      commercial_recommendation: commercialRecommendation,
      execution_assumptions: executionAssumptions,
      strategic_value_blocks: blocks,
      promotional_label: promotionalLabel,
      promotional_terms: promotionalTerms,
      discount_mode: discountMode,
      discount_percent: discountMode === 'percent' && discountPct > 0 ? discountPct : null,
      first_month_total: firstMonthRaw ? Number(firstMonthRaw) : null,
      recurring_monthly_total: recurringRaw ? Number(recurringRaw) : null,
      commitment_months: commitmentRaw ? Number(commitmentRaw) : null,
      ads_budget_note: adsBudgetNote,
      maintenance_note: maintenanceNote,
      revision_policy_note: revisionPolicyNote,
      payment_terms: paymentTerms,
      include_signature_block: (() => {
        const v = formData.getAll('include_signature_block');
        return v.length === 0 ? true : v.includes('true');
      })(),
      visible_to_client: formData.getAll('visible_to_client').includes('true'),
      created_by: user.id,
    })
    .select('id')
    .single();

  if (qErr || !quote) return actionError(qErr ? getPostgrestError(qErr) : 'Échec création devis.');

  const inserts = lines.map((l, i) => ({
    quote_id: quote.id,
    position: i,
    description: l.description,
    service_name: l.service_name,
    detail_text: l.detail_text,
    strategic_explanation: l.strategic_explanation,
    is_optional: l.is_optional,
    is_recommended: l.is_recommended,
    quantity: l.quantity,
    unit: l.unit,
    unit_price: l.unit_price,
    total: Math.round(l.quantity * l.unit_price * 100) / 100,
  }));

  const { error: liErr } = await supabase.from('quote_items').insert(inserts);

  if (liErr) {
    await supabase.from('quotes').delete().eq('id', quote.id);
    return actionError(getPostgrestError(liErr));
  }

  await logStaffActivity(ctx, {
    action: 'created',
    entityType: 'quote',
    entityId: quote.id,
    metadata: { ref, client_id: clientId },
  });

  revalidatePath('/quotes');
  revalidatePath('/dashboard');
  revalidatePath(`/clients/${clientId}`);
  return actionOk({ id: quote.id });
}

export async function updateQuoteStatusAction(id: string, status: QuoteStatus): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyQuotes(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const { data: qRow } = await supabase.from('quotes').select('client_id').eq('id', id).maybeSingle();
  if (!qRow || !(await assertQuoteRecordVisible(supabase, ctx, qRow.client_id))) {
    return actionError('Devis inaccessible.');
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'sent') patch.sent_at = new Date().toISOString();
  if (status === 'accepted' || status === 'refused') patch.decided_at = new Date().toISOString();

  const { error } = await supabase.from('quotes').update(patch).eq('id', id);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'quote',
    entityId: id,
    metadata: { status },
  });

  if (status === 'accepted' || status === 'refused') {
    const { data: q } = await supabase.from('quotes').select('ref,total,currency').eq('id', id).maybeSingle();
    if (q) {
      const base = appBaseUrl();
      await notifyFinanceTeam({
        type: status === 'accepted' ? 'quote_accepted' : 'system',
        priority: status === 'accepted' ? 'high' : 'normal',
        title: status === 'accepted' ? 'Devis accepté' : 'Devis refusé',
        message: `${q.ref} — ${q.total} ${q.currency}`,
        relatedEntityType: 'quote',
        relatedEntityId: id,
        linkUrl: `${base}/quotes/${id}`,
      });
    }
  }

  revalidatePath('/quotes');
  revalidatePath('/dashboard');
  return actionOk();
}

export async function updateQuoteWithItemsAction(quoteId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyQuotes(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const { data: existing, error: exErr } = await supabase
    .from('quotes')
    .select('id,status,client_id')
    .eq('id', quoteId)
    .single();
  if (exErr || !existing) return actionError('Devis introuvable.');
  if (existing.status === 'converted') return actionError('Devis converti — modification impossible.');
  if (!(await assertQuoteRecordVisible(supabase, ctx, existing.client_id))) {
    return actionError('Devis inaccessible.');
  }

  const linesRaw = String(formData.get('lines_json') ?? '').trim();
  const parsedLines = parseLinesJson(linesRaw);
  if (!parsedLines) return actionError('Lignes invalides.');
  if (!linesPricingOk(parsedLines)) {
    return actionError('Chaque ligne hors option doit avoir un prix unitaire positif.');
  }

  const taxRate = Number(formData.get('tax_rate') ?? 0) || 0;
  const discountMode = (String(formData.get('discount_mode') ?? 'fixed') === 'percent'
    ? 'percent'
    : 'fixed') as QuoteDiscountMode;
  const discountFixed = Number(formData.get('discount') ?? 0) || 0;
  const discountPct = Number(formData.get('discount_percent') ?? '') || 0;
  const validUntil = String(formData.get('valid_until') ?? '').trim();
  if (!validUntil) return actionError('La date de validité est requise.');

  const subPre = parsedLines.map((l) => ({ quantity: l.quantity, unit_price: l.unit_price }));
  const { subtotal, tax_amount } = computeTotals(subPre, taxRate, 0);
  const discount = resolveDiscountAmount(discountMode, discountFixed, discountPct, subtotal, tax_amount);
  const { total } = computeTotals(subPre, taxRate, discount);

  const blocks = parseStrategicBlocksJson(String(formData.get('strategic_blocks_json') ?? ''));

  const firstMonthRaw = String(formData.get('first_month_total') ?? '').trim();
  const recurringRaw = String(formData.get('recurring_monthly_total') ?? '').trim();
  const commitmentRaw = String(formData.get('commitment_months') ?? '').trim();

  const { error: uErr } = await supabase
    .from('quotes')
    .update({
      valid_until: validUntil,
      tax_rate: taxRate,
      tax_amount,
      discount,
      subtotal,
      total,
      currency: String(formData.get('currency') ?? 'MAD').trim() || 'MAD',
      notes: String(formData.get('notes') ?? '').trim() || null,
      conditions: String(formData.get('conditions') ?? '').trim() || null,
      template: String(formData.get('template') ?? '').trim() || 'supra_premium_black_orange',
      proposal_title: String(formData.get('proposal_title') ?? '').trim() || null,
      package_name: String(formData.get('package_name') ?? '').trim() || null,
      project_object: String(formData.get('project_object') ?? '').trim() || null,
      strategic_positioning: String(formData.get('strategic_positioning') ?? '').trim() || null,
      commercial_recommendation: String(formData.get('commercial_recommendation') ?? '').trim() || null,
      execution_assumptions: String(formData.get('execution_assumptions') ?? '').trim() || null,
      strategic_value_blocks: blocks,
      promotional_label: String(formData.get('promotional_label') ?? '').trim() || null,
      promotional_terms: String(formData.get('promotional_terms') ?? '').trim() || null,
      discount_mode: discountMode,
      discount_percent: discountMode === 'percent' && discountPct > 0 ? discountPct : null,
      first_month_total: firstMonthRaw ? Number(firstMonthRaw) : null,
      recurring_monthly_total: recurringRaw ? Number(recurringRaw) : null,
      commitment_months: commitmentRaw ? Number(commitmentRaw) : null,
      ads_budget_note: String(formData.get('ads_budget_note') ?? '').trim() || null,
      maintenance_note: String(formData.get('maintenance_note') ?? '').trim() || null,
      revision_policy_note: String(formData.get('revision_policy_note') ?? '').trim() || null,
      payment_terms: String(formData.get('payment_terms') ?? '').trim() || null,
      include_signature_block: (() => {
        const v = formData.getAll('include_signature_block');
        return v.length === 0 ? true : v.includes('true');
      })(),
      visible_to_client: formData.getAll('visible_to_client').includes('true'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId);

  if (uErr) return actionError(getPostgrestError(uErr));

  const { error: delErr } = await supabase.from('quote_items').delete().eq('quote_id', quoteId);
  if (delErr) return actionError(getPostgrestError(delErr));

  const inserts = parsedLines.map((l, i) => ({
    quote_id: quoteId,
    position: i,
    description: l.description,
    service_name: l.service_name,
    detail_text: l.detail_text,
    strategic_explanation: l.strategic_explanation,
    is_optional: l.is_optional,
    is_recommended: l.is_recommended,
    quantity: l.quantity,
    unit: l.unit,
    unit_price: l.unit_price,
    total: Math.round(l.quantity * l.unit_price * 100) / 100,
  }));

  const { error: insErr } = await supabase.from('quote_items').insert(inserts);
  if (insErr) return actionError(getPostgrestError(insErr));

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'quote',
    entityId: quoteId,
    metadata: { scope: 'items_and_terms' },
  });

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath('/dashboard');
  revalidatePath(`/clients/${existing.client_id}`);
  return actionOk();
}

export async function deleteQuoteAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyQuotes(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const { data: q } = await supabase.from('quotes').select('ref, client_id').eq('id', id).maybeSingle();
  if (!q || !(await assertQuoteRecordVisible(supabase, ctx, q.client_id))) {
    return actionError('Devis inaccessible.');
  }
  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'deleted',
    entityType: 'quote',
    entityId: id,
    metadata: { ref: q?.ref },
  });

  revalidatePath('/quotes');
  revalidatePath('/dashboard');
  return actionOk();
}

export async function convertQuoteToInvoiceAction(quoteId: string): Promise<ActionResult<{ invoiceId: string }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyQuotes(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const { data: quote, error: qe } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
  if (qe || !quote) return actionError('Devis introuvable.');
  if (!(await assertQuoteRecordVisible(supabase, ctx, quote.client_id))) {
    return actionError('Devis inaccessible.');
  }
  if (!(await assertInvoiceRecordVisible(supabase, ctx, quote.client_id))) {
    return actionError('Création de facture non autorisée pour ce client.');
  }
  if (quote.status !== 'accepted') return actionError('Seul un devis accepté peut être converti.');
  if (quote.converted_invoice_id) return actionError('Ce devis a déjà été converti.');

  const { data: items, error: ie } = await supabase.from('quote_items').select('*').eq('quote_id', quoteId).order('position');
  if (ie || !items?.length) return actionError('Lignes de devis manquantes.');

  const { data: refData, error: refErr } = await supabase.rpc('next_invoice_ref');
  if (refErr || !refData) return actionError(refErr ? getPostgrestError(refErr) : 'Référence facture indisponible.');
  const ref = refData as string;

  const dueDefault = new Date();
  dueDefault.setDate(dueDefault.getDate() + 30);
  const dueStr = dueDefault.toISOString().slice(0, 10);

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .insert({
      client_id: quote.client_id,
      ref,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: dueStr,
      status: 'draft' as InvoiceStatus,
      subtotal: quote.subtotal,
      tax_rate: quote.tax_rate,
      tax_amount: quote.tax_amount,
      discount: quote.discount,
      total: quote.total,
      currency: quote.currency,
      notes: quote.notes,
      visible_to_client: quote.visible_to_client,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (invErr || !inv) return actionError(invErr ? getPostgrestError(invErr) : 'Échec création facture.');

  const lineRows = items.map((line, i) => ({
    invoice_id: inv.id,
    position: i,
    description: invoiceDescriptionFromQuoteItem(line),
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
    total: line.total,
  }));

  const { error: liErr } = await supabase.from('invoice_items').insert(lineRows);
  if (liErr) {
    await supabase.from('invoices').delete().eq('id', inv.id);
    return actionError(getPostgrestError(liErr));
  }

  const { error: uqErr } = await supabase
    .from('quotes')
    .update({
      converted_invoice_id: inv.id,
      status: 'converted' as QuoteStatus,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId);

  if (uqErr) return actionError(getPostgrestError(uqErr));

  await logStaffActivity(ctx, {
    action: 'converted_to_invoice',
    entityType: 'quote',
    entityId: quoteId,
    metadata: { invoice_id: inv.id, quote_ref: quote.ref },
  });

  const base = appBaseUrl();
  await notifyFinanceTeam({
    type: 'quote_converted',
    priority: 'normal',
    title: 'Devis converti en facture',
    message: `${quote.ref} → ${ref}`,
    relatedEntityType: 'invoice',
    relatedEntityId: inv.id,
    linkUrl: `${base}/invoices`,
  });

  revalidatePath('/quotes');
  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  revalidatePath(`/clients/${quote.client_id}`);
  return actionOk({ invoiceId: inv.id });
}
