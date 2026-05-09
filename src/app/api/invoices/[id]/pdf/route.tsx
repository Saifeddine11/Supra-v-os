import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canViewInvoices } from '@/lib/auth/capabilities';
import { getInvoiceWithItems } from '@/lib/data/invoices';
import { getClientById } from '@/lib/data/clients';
import { InvoicePdfDocument } from '@/lib/pdf/invoice-document';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Non authentifié.', { status: 401 });
  }

  const ctx = await getAuthContext();
  if (!ctx || !canViewInvoices(ctx.role)) {
    return new Response('Accès refusé.', { status: 403 });
  }

  const { invoice, items } = await getInvoiceWithItems(id, ctx);
  if (!invoice) {
    return new Response('Facture introuvable.', { status: 404 });
  }

  const client = await getClientById(invoice.client_id, ctx);
  if (!client) {
    return new Response('Client introuvable.', { status: 404 });
  }

  const agencyName = process.env.NEXT_PUBLIC_AGENCY_NAME ?? 'Supra v.';

  const buffer = await renderToBuffer(
    <InvoicePdfDocument invoice={invoice} items={items} client={client} agencyName={agencyName} />
  );

  const filename = `${invoice.ref.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
  return new Response(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
