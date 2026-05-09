import { renderToBuffer } from '@react-pdf/renderer';
import { getAuthContext } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { getReportById } from '@/lib/data/reports-data';
import { ReportPdfDocument } from '@/lib/pdf/report-document';
import { toReportPdfContent } from '@/lib/pdf/report-pdf-map';

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
  if (!ctx?.role) {
    return new Response('Accès refusé.', { status: 403 });
  }

  const report = await getReportById(id, ctx);
  if (!report) {
    return new Response('Rapport introuvable.', { status: 404 });
  }

  const agencyName = process.env.NEXT_PUBLIC_AGENCY_NAME ?? 'Supra v.';
  const clientName = report.clients?.name ?? 'Client';
  const pdfPayload = toReportPdfContent(report);

  const buffer = await renderToBuffer(
    <ReportPdfDocument report={pdfPayload} clientName={clientName} agencyName={agencyName} />
  );

  const safeTitle = pdfPayload.title.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80);
  const filename = `${safeTitle || 'rapport'}_supra.pdf`;
  return new Response(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
