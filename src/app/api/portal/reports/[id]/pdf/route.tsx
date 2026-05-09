import { renderToBuffer } from '@react-pdf/renderer';
import { validatePortalToken } from '@/lib/portal/validate';
import { createAdminClient } from '@/lib/supabase/admin';
import { ReportPdfDocument } from '@/lib/pdf/report-document';
import { toReportPdfContent } from '@/lib/pdf/report-pdf-map';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const clientId = searchParams.get('clientId')?.trim();

  if (!clientId) {
    return new Response('Paramètre clientId requis.', { status: 400 });
  }

  const validation = await validatePortalToken(clientId, token);
  if (!validation.ok) {
    return new Response('Accès refusé.', { status: 403 });
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('reports')
    .select(
      'title, period_start, period_end, summary, highlights, next_actions, recommendations, visible_to_client, client_id'
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !row) {
    return new Response('Rapport introuvable.', { status: 404 });
  }

  if (row.client_id !== clientId) {
    return new Response('Accès refusé.', { status: 403 });
  }

  if (!row.visible_to_client) {
    return new Response('Non disponible.', { status: 404 });
  }

  const { data: clientRow } = await admin.from('clients').select('name').eq('id', clientId).maybeSingle();
  const pdfPayload = toReportPdfContent(row);
  const agencyName = process.env.NEXT_PUBLIC_AGENCY_NAME ?? 'Supra v.';
  const clientName = clientRow?.name ?? 'Client';

  const buffer = await renderToBuffer(
    <ReportPdfDocument report={pdfPayload} clientName={clientName} agencyName={agencyName} />
  );

  const safeTitle = pdfPayload.title.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80);
  const filename = `${safeTitle || 'rapport'}_supra.pdf`;
  return new Response(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
