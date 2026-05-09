import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { listReportsWithClients } from '@/lib/data/reports-data';
import { listClients } from '@/lib/data/clients';
import { getAuthContext } from '@/lib/auth/permissions';
import { canModifyClients } from '@/lib/auth/capabilities';
import { REPORT_TYPE_LABELS } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { ReportFormDialog } from './report-form-dialog';
import { ReportRowActions } from './report-row-actions';

export const metadata: Metadata = { title: 'Rapports' };

export default async function ReportsPage() {
  const ctx = await getAuthContext();
  const canModify = canModifyClients(ctx?.role ?? null);

  const [reports, clients] = await Promise.all([listReportsWithClients(ctx), listClients({}, ctx)]);
  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Rapports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bilans client — visibilité portail pilotée par case à cocher.
          </p>
        </div>
        {canModify ? (
          <ReportFormDialog
            clients={clientOpts}
            trigger={
              <Button variant="primary" className="rounded-full">
                <Plus className="h-4 w-4" />
                Nouveau rapport
              </Button>
            }
          />
        ) : null}
      </div>

      <SectionCard title="Liste" description={`${reports.length} rapport(s)`}>
        {reports.length === 0 ? (
          <EmptyState title="Aucun rapport" description="Créez un premier rapport pour un client." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Titre</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Portail</th>
                  <th className="px-4 py-3 font-medium">Créé</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {reports.map((r) => (
                  <tr key={r.id} className="bg-card/40 transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{r.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{REPORT_TYPE_LABELS[r.type]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.clients?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={r.visible_to_client ? 'success' : 'outline'}>
                        {r.visible_to_client ? 'Client' : 'Interne'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {format(new Date(r.created_at), 'd MMM yyyy', { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ReportRowActions report={r} canModify={canModify} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
