import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import { normalizeDiscountMode, normalizeQuoteItemRow, normalizeStrategicBlocks } from '@/lib/quotes/normalize';
import { assertQuoteRecordVisible, resolveVisibleClientIds } from '@/lib/auth/data-scope';
import { canModifyQuotes } from '@/lib/auth/capabilities';
import type { Quote, QuoteItem } from '@/types/database';

export type QuoteWithClient = Quote & { clients: { name: string; id: string } | null };

export function mapQuoteRow(raw: Record<string, unknown>): QuoteWithClient {
  const q = raw as unknown as QuoteWithClient;
  return {
    ...q,
    strategic_value_blocks: normalizeStrategicBlocks(raw.strategic_value_blocks),
    discount_mode: normalizeDiscountMode(raw.discount_mode),
    discount_percent:
      raw.discount_percent != null && raw.discount_percent !== ''
        ? Number(raw.discount_percent)
        : null,
    first_month_total:
      raw.first_month_total != null && raw.first_month_total !== ''
        ? Number(raw.first_month_total)
        : null,
    recurring_monthly_total:
      raw.recurring_monthly_total != null && raw.recurring_monthly_total !== ''
        ? Number(raw.recurring_monthly_total)
        : null,
    commitment_months:
      raw.commitment_months != null && raw.commitment_months !== ''
        ? Number(raw.commitment_months)
        : null,
    include_signature_block: raw.include_signature_block !== false,
    proposal_title: (raw.proposal_title as string | null | undefined) ?? null,
    package_name: (raw.package_name as string | null | undefined) ?? null,
    project_object: (raw.project_object as string | null | undefined) ?? null,
    strategic_positioning: (raw.strategic_positioning as string | null | undefined) ?? null,
    commercial_recommendation: (raw.commercial_recommendation as string | null | undefined) ?? null,
    execution_assumptions: (raw.execution_assumptions as string | null | undefined) ?? null,
    promotional_label: (raw.promotional_label as string | null | undefined) ?? null,
    promotional_terms: (raw.promotional_terms as string | null | undefined) ?? null,
    ads_budget_note: (raw.ads_budget_note as string | null | undefined) ?? null,
    maintenance_note: (raw.maintenance_note as string | null | undefined) ?? null,
    revision_policy_note: (raw.revision_policy_note as string | null | undefined) ?? null,
    payment_terms: (raw.payment_terms as string | null | undefined) ?? null,
  };
}

export async function listQuotesWithClients(
  ctx: AuthContext | null = null
): Promise<QuoteWithClient[]> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role || !canModifyQuotes(auth.role)) return [];

  const scope = await resolveVisibleClientIds(supabase, auth);
  if (scope !== 'all' && scope.length === 0) return [];

  let q = supabase.from('quotes').select('*, clients(name, id)').order('issue_date', { ascending: false });
  if (scope !== 'all') q = q.in('client_id', scope);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapQuoteRow(row as Record<string, unknown>));
}

export async function getQuoteWithItems(
  id: string,
  ctx: AuthContext | null = null
): Promise<{
  quote: QuoteWithClient | null;
  items: QuoteItem[];
}> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  const { data: q, error: e1 } = await supabase
    .from('quotes')
    .select('*, clients(name, id)')
    .eq('id', id)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!q || !auth?.role) {
    return { quote: null, items: [] };
  }

  const row = mapQuoteRow(q as Record<string, unknown>);
  if (!(await assertQuoteRecordVisible(supabase, auth, row.client_id))) {
    return { quote: null, items: [] };
  }

  const { data: items, error: e2 } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', id)
    .order('position');
  if (e2) throw new Error(e2.message);
  const mappedItems = (items ?? []).map((i) => normalizeQuoteItemRow(i as QuoteItem));
  return { quote: row, items: mappedItems };
}
