import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { listQuotesWithClients } from '@/lib/data/quotes';
import { listClients } from '@/lib/data/clients';
import { getAuthContext } from '@/lib/auth/permissions';
import { canModifyQuotes, canViewInvoices } from '@/lib/auth/capabilities';
import { QUOTE_STATUS_MAP } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { getStatusTableRowClasses, quoteStatusToTone } from '@/lib/ui/status-block-tone';
import { AccessDenied } from '@/components/shared/access-denied';
import { QuoteFormDialog } from './quote-form-dialog';
import { QuoteRowActions } from './quote-row-actions';

export const metadata: Metadata = { title: 'Devis' };

export default async function QuotesPage() {
  const ctx = await getAuthContext();
  const canView = canViewInvoices(ctx?.role ?? null);
  const canModify = canModifyQuotes(ctx?.role ?? null);

  if (!canView) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12">
        <AccessDenied />
      </div>
    );
  }

  const [quotes, clients] = await Promise.all([listQuotesWithClients(ctx), listClients({}, ctx)]);
  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Devis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Propositions commerciales — conversion en facture en un clic lorsque le devis est accepté.
          </p>
        </div>
        {canModify ? (
          <QuoteFormDialog
            clients={clientOpts}
            trigger={
              <Button variant="primary" className="rounded-full">
                <Plus className="h-4 w-4" />
                Nouveau devis
              </Button>
            }
          />
        ) : null}
      </div>

      <SectionCard title="Liste" description={`${quotes.length} devis`}>
        {quotes.length === 0 ? (
          <EmptyState title="Aucun devis" description="Créez un premier devis pour un client." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Réf.</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Montant TTC</th>
                  <th className="px-4 py-3 font-medium">Valide jusqu&apos;au</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {quotes.map((q) => {
                  const expiredUi =
                    q.status !== 'converted' && q.status !== 'accepted' && q.valid_until < today;
                  const rowTone = quoteStatusToTone(q.status, { expiredUi });
                  const tone =
                    q.status === 'accepted' || q.status === 'converted'
                      ? 'success'
                      : q.status === 'refused'
                        ? 'destructive'
                        : expiredUi || q.status === 'expired'
                          ? 'outline'
                          : 'outline';
                  return (
                    <tr key={q.id} className={cn(getStatusTableRowClasses(rowTone))}>
                      <td className="px-4 py-3 font-medium text-foreground">{q.ref}</td>
                      <td className="px-4 py-3 text-muted-foreground">{q.clients?.name ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">
                        {q.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {q.currency}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 tabular-nums text-muted-foreground',
                          expiredUi && 'font-semibold text-orange-300'
                        )}
                      >
                        {format(new Date(q.valid_until), 'd MMM yyyy', { locale: fr })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            tone === 'success' ? 'success' : tone === 'destructive' ? 'destructive' : 'outline'
                          }
                        >
                          {QUOTE_STATUS_MAP[q.status].label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <QuoteRowActions quote={q} canModify={canModify} />
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
