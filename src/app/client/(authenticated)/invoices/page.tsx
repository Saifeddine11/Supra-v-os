import type { Metadata } from 'next';
import { requireClientAuth } from '@/lib/clients/session';
import { loadClientInvoices } from '@/lib/clients/workspace-data';
import {
  ClientFinanceBlock,
  ClientInvoiceTable,
  ClientSectionTitle,
  ClientSurface,
} from '@/components/client-workspace/client-ui';

export const metadata: Metadata = { title: 'Factures' };

export default async function ClientInvoicesPage() {
  const session = await requireClientAuth();
  const { invoices, finance } = await loadClientInvoices(session);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ClientSurface>
        <ClientSectionTitle title="Situation" />
        <ClientFinanceBlock finance={finance} />
      </ClientSurface>
      <ClientSurface>
        <ClientSectionTitle title="Factures" hint="Uniquement les factures visibles de votre compte." />
        <ClientInvoiceTable invoices={invoices} empty="Aucune facture n’est encore disponible." />
      </ClientSurface>
    </div>
  );
}
