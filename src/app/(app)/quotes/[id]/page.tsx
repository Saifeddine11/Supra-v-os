import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getQuoteWithItems } from '@/lib/data/quotes';
import { getAuthContext } from '@/lib/auth/permissions';
import { canModifyQuotes, canViewInvoices } from '@/lib/auth/capabilities';
import { QUOTE_STATUS_MAP } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import { QuoteEditForm } from '../quote-edit-form';
import { QuoteDetailActions } from './quote-detail-actions';
import { listActivityForEntity } from '@/lib/data/activity-logs';
import { EntityActivityFeed } from '@/components/activity/entity-activity-feed';
import { getAgencyDisplayCurrency } from '@/lib/data/agency-settings-db';
import { formatAgencyMoney } from '@/lib/money/format-money';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const metaCtx = await getAuthContext();
  const { quote } = await getQuoteWithItems(id, metaCtx);
  return { title: quote ? `Devis ${quote.ref}` : 'Devis' };
}

export default async function QuoteDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getAuthContext();
  const canView = canViewInvoices(ctx?.role ?? null);
  const canModify = canModifyQuotes(ctx?.role ?? null);

  if (!canView) {
    return (
      <div className="rounded-xl border border-border/80 bg-card/80 p-8 text-center text-sm text-muted-foreground">
        Accès refusé.
      </div>
    );
  }

  let quoteActivity: Awaited<ReturnType<typeof listActivityForEntity>> = [];
  try {
    quoteActivity = await listActivityForEntity('quote', id, 25);
  } catch {
    quoteActivity = [];
  }

  const [{ quote, items }, agencyCurrency] = await Promise.all([getQuoteWithItems(id, ctx), getAgencyDisplayCurrency()]);
  if (!quote) notFound();

  const canEdit = canModify && quote.status !== 'converted';
  const displayTitle = (quote.proposal_title ?? '').trim() || 'Proposition commerciale';
  const packageLine = (quote.package_name ?? '').trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="h-9 rounded-full" asChild>
          <Link href="/quotes">
            <ArrowLeft className="h-4 w-4" />
            Devis
          </Link>
        </Button>
        <Badge variant="outline">{QUOTE_STATUS_MAP[quote.status].label}</Badge>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Supra v.</p>
          <h1 className="mt-1 font-sans text-2xl font-semibold tracking-tight text-foreground">{quote.ref}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{displayTitle}</p>
          {packageLine ? (
            <p className="mt-2 text-sm font-medium text-foreground">{packageLine}</p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">
            {quote.clients?.name ?? 'Client'} · émis le {format(new Date(quote.issue_date), 'd MMM yyyy', { locale: fr })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" />
              Télécharger le PDF
            </Link>
          </Button>
          <QuoteDetailActions quote={quote} canModify={canModify} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total TTC</p>
          <p className="mt-2 font-sans text-xl font-semibold tabular-nums text-foreground">
            {formatAgencyMoney(quote.total, agencyCurrency)}
          </p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Validité</p>
          <p className="mt-2 font-medium text-foreground">
            {format(new Date(quote.valid_until), 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Portail client</p>
          <p className="mt-2 text-sm text-foreground">{quote.visible_to_client ? 'Visible' : 'Masqué'}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Modèle PDF</p>
          <p className="mt-2 text-sm text-foreground">
            {quote.template === 'supra_premium_black_orange' ? 'Supra Premium Noir & Orange' : quote.template}
          </p>
        </div>
      </div>

      {quote.commercial_recommendation ? (
        <SectionCard title="Recommandation" description="Synthèse commerciale — également sur le PDF.">
          <p className="text-sm leading-relaxed text-muted-foreground">{quote.commercial_recommendation}</p>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Constructeur de proposition"
        description="Édition complète : prestations, apports stratégiques, offre et PDF premium."
      >
        <QuoteEditForm quote={quote} items={items} canEdit={canEdit} agencyDisplayCurrency={agencyCurrency} />
      </SectionCard>

      <SectionCard title="Aperçu des lignes" description="Récapitulatif rapide — le détail éditable se trouve ci-dessus.">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune ligne.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
            {items.map((i) => (
              <li key={i.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{i.service_name || i.description}</p>
                    {i.detail_text ? (
                      <p className="mt-1 text-xs text-muted-foreground">{i.detail_text}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {i.is_recommended ? 'Recommandé · ' : ''}
                      {i.is_optional ? 'Option · ' : ''}
                      {i.quantity} × {formatAgencyMoney(i.unit_price, agencyCurrency)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 tabular-nums text-sm text-foreground">
                  {formatAgencyMoney(i.total, agencyCurrency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Activité" description="Historique des actions sur ce devis.">
        <EntityActivityFeed logs={quoteActivity} />
      </SectionCard>
    </div>
  );
}
