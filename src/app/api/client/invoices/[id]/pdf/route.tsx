import { renderToBuffer } from '@react-pdf/renderer';
import { getClientAuthState } from '@/lib/clients/session';
import { parseUuidParam } from '@/lib/security/input-validation';
import { assertOwnedByAuthenticatedClient } from '@/lib/clients/ownership';
import { createAdminClient } from '@/lib/supabase/admin';
import { InvoicePdfDocument } from '@/lib/pdf/invoice-document';
import { getAgencyDisplayCurrencyWithClient } from '@/lib/data/agency-settings-db';
import type { Client, Invoice, InvoiceItem } from '@/types/database';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseUuidParam(rawId);
  if (!id) return new Response('Facture introuvable.', { status: 404 });

  const state = await getClientAuthState();
  if (state.kind !== 'ok') return new Response('Non authentifié.', { status: 401 });
  if (state.ctx.mustChangePassword) return new Response('Accès refusé.', { status: 403 });

  const session = state.ctx;
  const admin = createAdminClient();

  const { data: invoice, error } = await admin
    .from('invoices')
    .select(
      'id, client_id, ref, status, total, subtotal, tax_rate, tax_amount, discount, currency, due_date, issue_date, paid_at, payment_terms, visible_to_client',
    )
    .eq('id', id)
    .eq('client_id', session.clientId)
    .eq('visible_to_client', true)
    .maybeSingle();

  if (error || !invoice) return new Response('Facture introuvable.', { status: 404 });
  if (assertOwnedByAuthenticatedClient(invoice.client_id as string, session.clientId) !== 'ok') {
    return new Response('Facture introuvable.', { status: 404 });
  }
  if (invoice.status === 'draft' || invoice.status === 'cancelled') {
    return new Response('Facture introuvable.', { status: 404 });
  }

  const [{ data: items }, { data: client }, displayCurrency] = await Promise.all([
    admin.from('invoice_items').select('id, invoice_id, position, description, quantity, unit, unit_price, total').eq('invoice_id', id).order('position'),
    admin
      .from('clients')
      .select('id, name, legal_name, address, city, country, email, phone, currency')
      .eq('id', session.clientId)
      .maybeSingle(),
    getAgencyDisplayCurrencyWithClient(admin),
  ]);

  if (!client) return new Response('Facture introuvable.', { status: 404 });

  const agencyName = process.env.NEXT_PUBLIC_AGENCY_NAME ?? 'Supra v.';
  const buffer = await renderToBuffer(
    <InvoicePdfDocument
      invoice={invoice as Invoice}
      items={(items ?? []) as InvoiceItem[]}
      client={client as Client}
      agencyName={agencyName}
      displayCurrency={displayCurrency}
    />,
  );

  const filename = `${String(invoice.ref).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
  return new Response(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
