import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listPaymentsWithRelations, getPaymentDashboardStats } from '@/lib/data/payments';
import { listInvoicesWithClients } from '@/lib/data/invoices';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManagePayments, canViewInvoices } from '@/lib/auth/capabilities';
import { INVOICE_STATUS_MAP, PAYMENT_METHOD_LABELS } from '@/types/domain';
import type { InvoiceStatus } from '@/types/database';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AccessDenied } from '@/components/shared/access-denied';
import { PaymentFormDialog } from './payment-form-dialog';
import { PaymentsToolbar } from './payments-toolbar';
import { PaymentRowActions } from './payment-row-actions';
import { getAgencyDisplayCurrency } from '@/lib/data/agency-settings-db';
import { formatAgencyMoney } from '@/lib/money/format-money';

export const metadata: Metadata = { title: 'Paiements' };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    client?: string;
    method?: string;
    from?: string;
    to?: string;
    invStatus?: string;
  }>;
}) {
  const ctx = await getAuthContext();
  const canView = canViewInvoices(ctx?.role ?? null);
  const canPay = canManagePayments(ctx?.role ?? null);

  if (!canView) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12">
        <AccessDenied />
      </div>
    );
  }

  const sp = await searchParams;
  const invStatus =
    sp?.invStatus === 'all' || !sp?.invStatus ? 'all' : (sp.invStatus as InvoiceStatus);

  const [payments, stats, invoices, agencyCurrency] = await Promise.all([
    listPaymentsWithRelations(
      {
        search: sp?.q,
        clientId: sp?.client === 'all' || !sp?.client ? 'all' : sp.client,
        method: sp?.method === 'all' || !sp?.method ? 'all' : (sp.method as 'bank_transfer'),
        from: sp?.from,
        to: sp?.to,
        invoiceStatus: invStatus,
      },
      ctx
    ),
    getPaymentDashboardStats(ctx),
    listInvoicesWithClients(ctx),
    getAgencyDisplayCurrency(),
  ]);
  const clientOpts = [...new Map(invoices.map((i) => [i.client_id, i.clients?.name ?? ''])).entries()].map(
    ([id, name]) => ({ id, name })
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Paiements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Encaissements, rapprochement factures et vision trésorerie.
          </p>
        </div>
        {canPay ? (
          <PaymentFormDialog
            invoices={invoices}
            agencyDisplayCurrency={agencyCurrency}
            trigger={
              <Button variant="primary" className="rounded-full">
                <Plus className="h-4 w-4" />
                Nouveau paiement
              </Button>
            }
          />
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: 'Encaissé ce mois',
            value: formatAgencyMoney(stats.collected_this_month, stats.currency),
            hint: `${stats.payments_count_month} paiement(s) enregistré(s) ce mois`,
          },
          {
            title: 'Montant en attente',
            value: formatAgencyMoney(stats.pending_invoices_amount, stats.currency),
            hint: 'Factures non soldées (hors retard)',
          },
          {
            title: 'Montant en retard',
            value: formatAgencyMoney(stats.overdue_invoices_amount, stats.currency),
            hint: 'À relancer',
          },
          {
            title: 'Lignes affichées',
            value: String(payments.length),
            hint: 'Après filtres courants',
          },
        ].map((s) => (
          <article
            key={s.title}
            className="relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-[0_8px_24px_-16px_rgba(8,7,6,0.18)] dark:shadow-[0_8px_28px_-18px_rgba(255,61,10,0.12)]"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/[0.06] blur-2xl" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.title}</p>
            <p className="mt-2 font-sans text-xl font-semibold tracking-tight text-foreground">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </article>
        ))}
      </div>

      <PaymentsToolbar
        clients={clientOpts}
        defaultQ={sp?.q}
        defaultClient={sp?.client ?? 'all'}
        defaultMethod={sp?.method ?? 'all'}
        defaultFrom={sp?.from}
        defaultTo={sp?.to}
        defaultInvoiceStatus={sp?.invStatus ?? 'all'}
      />

      <SectionCard title="Historique" description={`${payments.length} paiement(s)`}>
        {payments.length === 0 ? (
          <EmptyState title="Aucun paiement" description="Les encaissements apparaîtront ici." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Facture</th>
                  <th className="px-4 py-3 font-medium">Statut facture</th>
                  <th className="px-4 py-3 font-medium">Montant</th>
                  <th className="px-4 py-3 font-medium">Méthode</th>
                  <th className="px-4 py-3 font-medium">Réf.</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {payments.map((p) => {
                  const inv = p.invoices;
                  const invSt = inv ? INVOICE_STATUS_MAP[inv.status] : null;
                  return (
                    <tr key={p.id} className="bg-card/40 transition-colors hover:bg-accent/30">
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.payment_date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.clients?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        {inv ? (
                          <Link
                            href="/invoices"
                            className="font-mono text-foreground underline-offset-4 hover:text-primary hover:underline"
                          >
                            {inv.ref}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {invSt ? (
                          <Badge variant="outline" className="font-normal">
                            {invSt.label}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-foreground">
                        {formatAgencyMoney(p.amount, agencyCurrency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-normal">
                          {PAYMENT_METHOD_LABELS[p.method]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.reference ?? '—'}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground" title={p.notes ?? ''}>
                        {p.notes ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PaymentRowActions paymentId={p.id} canDelete={canPay} />
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
