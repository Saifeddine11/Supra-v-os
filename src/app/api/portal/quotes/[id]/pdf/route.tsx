import { renderToBuffer } from '@react-pdf/renderer';
import { validatePortalToken } from '@/lib/portal/validate';
import { createAdminClient } from '@/lib/supabase/admin';
import { mapQuoteRow } from '@/lib/data/quotes';
import { QuotePdfDocument } from '@/lib/pdf/quote-document';
import type { QuoteItem } from '@/types/database';
import { normalizeQuoteItemRow } from '@/lib/quotes/normalize';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const clientId = searchParams.get('clientId');

  if (!clientId?.trim()) {
    return new Response('Paramètre clientId requis.', { status: 400 });
  }

  const validation = await validatePortalToken(clientId.trim(), token);
  if (!validation.ok) {
    return new Response('Accès refusé.', { status: 403 });
  }

  const admin = createAdminClient();
  const { data: quoteRow, error: qErr } = await admin.from('quotes').select('*').eq('id', id).maybeSingle();

  if (qErr || !quoteRow) {
    return new Response('Devis introuvable.', { status: 404 });
  }

  if (quoteRow.client_id !== clientId.trim()) {
    return new Response('Accès refusé.', { status: 403 });
  }

  if (!quoteRow.visible_to_client) {
    return new Response('Document non disponible.', { status: 404 });
  }

  const { data: itemsRaw, error: iErr } = await admin
    .from('quote_items')
    .select(
      'id, quote_id, position, description, service_name, detail_text, strategic_explanation, is_optional, is_recommended, quantity, unit, unit_price, total, created_at'
    )
    .eq('quote_id', id)
    .order('position');

  if (iErr) {
    return new Response('Erreur chargement.', { status: 500 });
  }

  const { data: clientRow, error: cErr } = await admin.from('clients').select('name').eq('id', clientId.trim()).maybeSingle();

  if (cErr || !clientRow?.name) {
    return new Response('Client introuvable.', { status: 404 });
  }

  const quote = mapQuoteRow({ ...(quoteRow as Record<string, unknown>), notes: null, clients: null });
  const items = (itemsRaw ?? []).map((row) => normalizeQuoteItemRow(row as QuoteItem));
  const agencyName = process.env.NEXT_PUBLIC_AGENCY_NAME ?? 'Supra v.';

  const buffer = await renderToBuffer(
    <QuotePdfDocument quote={quote} items={items} client={{ name: clientRow.name }} agencyName={agencyName} />
  );

  const filename = `${quote.ref.replace(/[^a-zA-Z0-9-_]/g, '_')}_proposition.pdf`;
  return new Response(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
