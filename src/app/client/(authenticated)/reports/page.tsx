import type { Metadata } from 'next';
import { requireClientAuth } from '@/lib/clients/session';
import { loadClientReports } from '@/lib/clients/workspace-data';
import { ClientReportList, ClientSectionTitle, ClientSurface } from '@/components/client-workspace/client-ui';

export const metadata: Metadata = { title: 'Rapports' };

export default async function ClientReportsPage() {
  const session = await requireClientAuth();
  const { reports } = await loadClientReports(session);
  return (
    <div className="mx-auto max-w-4xl">
      <ClientSurface>
        <ClientSectionTitle title="Rapports partagés" />
        <ClientReportList reports={reports} />
      </ClientSurface>
    </div>
  );
}
