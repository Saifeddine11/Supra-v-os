import { renderToBuffer } from '@react-pdf/renderer';
import { getAuthContext } from '@/lib/auth/permissions';
import { canModifyQuotes } from '@/lib/auth/capabilities';
import { createClient } from '@/lib/supabase/server';
import { getQuoteWithItems } from '@/lib/data/quotes';
import { getClientById } from '@/lib/data/clients';
import { QuotePdfDocument } from '@/lib/pdf/quote-document';

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
  if (!ctx || !canModifyQuotes(ctx.role)) {
    return new Response('Accès refusé.', { status: 403 });
  }

  const { quote, items } = await getQuoteWithItems(id, ctx);
  if (!quote) {
    return new Response('Devis introuvable.', { status: 404 });
  }

  const client = await getClientById(quote.client_id, ctx);
  if (!client) {
    return new Response('Client introuvable.', { status: 404 });
  }

  const agencyName = process.env.NEXT_PUBLIC_AGENCY_NAME ?? 'Supra v.';

  const buffer = await renderToBuffer(
    <QuotePdfDocument quote={quote} items={items} client={client} agencyName={agencyName} />
  );

  const filename = `${quote.ref.replace(/[^a-zA-Z0-9-_]/g, '_')}_proposition.pdf`;
  return new Response(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
