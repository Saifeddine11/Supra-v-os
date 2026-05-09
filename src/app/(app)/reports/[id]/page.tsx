import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { getReportById } from '@/lib/data/reports-data';
import { listClients } from '@/lib/data/clients';
import { getAuthContext } from '@/lib/auth/permissions';
import { canModifyClients } from '@/lib/auth/capabilities';
import { REPORT_TYPE_LABELS } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/section-card';
import { ReportEditForm } from '../report-edit-form';
import { ReportWhatsappButton } from '../report-whatsapp-button';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const metaCtx = await getAuthContext();
  const r = await getReportById(id, metaCtx);
  return { title: r ? r.title : 'Rapport' };
}

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getAuthContext();
  const canModify = canModifyClients(ctx?.role ?? null);

  const [report, clients] = await Promise.all([getReportById(id, ctx), listClients({}, ctx)]);
  if (!report) notFound();

  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" className="h-9 rounded-full" asChild>
            <Link href="/reports">
              <ArrowLeft className="h-4 w-4" />
              Rapports
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">{REPORT_TYPE_LABELS[report.type]}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link href={`/api/reports/${report.id}/pdf`} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" />
              PDF
            </Link>
          </Button>
          <ReportWhatsappButton text={report.whatsapp_text} />
        </div>
      </div>

      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">{report.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{report.clients?.name ?? 'Client'}</p>
      </div>

      <SectionCard title="Contenu" description={canModify ? 'Modifiez et enregistrez.' : 'Lecture seule.'}>
        {canModify ? (
          <ReportEditForm report={report} clientOptions={clientOpts} />
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            {report.summary ? <p className="text-foreground">{report.summary}</p> : null}
            {report.next_actions ? (
              <div>
                <p className="text-xs font-semibold uppercase text-primary">Prochaines actions</p>
                <p>{report.next_actions}</p>
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
