import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { listInvoicesWithClients } from '@/lib/data/invoices';
import { listClients } from '@/lib/data/clients';
import { getAuthContext } from '@/lib/auth/permissions';
import { canModifyInvoices, canViewInvoices } from '@/lib/auth/capabilities';
import { INVOICE_STATUS_MAP } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { getStatusTableRowClasses, invoiceStatusToTone } from '@/lib/ui/status-block-tone';
import { AccessDenied } from '@/components/shared/access-denied';
import { InvoiceFormDialog } from './invoice-form-dialog';
import { InvoiceRowActions } from './invoice-row-actions';
import { getAgencyDisplayCurrency } from '@/lib/data/agency-settings-db';
import { formatAgencyMoney } from '@/lib/money/format-money';

export const metadata: Metadata = { title: 'Factures' };

export default async function InvoicesPage() {
  const ctx = await getAuthContext();
  const canView = canViewInvoices(ctx?.role ?? null);
  const canModify = canModifyInvoices(ctx?.role ?? null);

  if (!canView) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12">
        <AccessDenied />
      </div>
    );
  }

  const [invoices, clients, agencyCurrency] = await Promise.all([
    listInvoicesWithClients(ctx),
    listClients({}, ctx),
    getAgencyDisplayCurrency(),
  ]);
  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Factures</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivi des échéances — synchronisation automatique des retards à l&apos;affichage.
          </p>
        </div>
        {canModify ? (
          <InvoiceFormDialog
            clients={clientOpts}
            defaultCurrency={agencyCurrency}
            trigger={
              <Button variant="primary" className="rounded-full">
                <Plus className="h-4 w-4" />
                Nouvelle facture
              </Button>
            }
          />
        ) : null}
      </div>

      <SectionCard title="Liste" description={`${invoices.length} facture(s)`}>
        {invoices.length === 0 ? (
          <EmptyState title="Aucune facture" description="Créez un brouillon pour démarrer la facturation." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Réf.</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Montant TTC</th>
                  <th className="px-4 py-3 font-medium">Échéance</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {invoices.map((inv) => {
                  const overdueUi =
                    inv.status !== 'paid' &&
                    inv.status !== 'cancelled' &&
                    inv.status !== 'draft' &&
                    inv.due_date < today;
                  const statusTone =
                    inv.status === 'paid'
                      ? 'success'
                      : inv.status === 'overdue' || overdueUi
                        ? 'destructive'
                        : 'outline';
                  const rowTone = invoiceStatusToTone(inv.status, overdueUi);
                  return (
                    <tr key={inv.id} className={cn(getStatusTableRowClasses(rowTone))}>
                      <td className="px-4 py-3 font-medium text-foreground">{inv.ref}</td>
                      <td className="px-4 py-3 text-muted-foreground">{inv.clients?.name ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">
                        {formatAgencyMoney(inv.total, agencyCurrency)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 tabular-nums text-muted-foreground',
                          overdueUi && 'font-semibold text-destructive'
                        )}
                      >
                        {format(new Date(inv.due_date), 'd MMM yyyy', { locale: fr })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={statusTone === 'success' ? 'success' : statusTone === 'destructive' ? 'destructive' : 'outline'}
                        >
                          {INVOICE_STATUS_MAP[inv.status].label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <InvoiceRowActions invoice={inv} canView={canView} canModify={canModify} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
