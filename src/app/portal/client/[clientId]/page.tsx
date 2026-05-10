import type { Metadata } from 'next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { validatePortalToken, recordPortalAccess } from '@/lib/portal/validate';
import { loadPortalPublicData } from '@/lib/portal/load-public-data';
import { getMonthlyVideoDeliverySnapshot } from '@/lib/portal/quota';
import { INVOICE_STATUS_MAP, QUOTE_STATUS_MAP, VIDEO_PUBLIC_STATUS_MAP } from '@/types/domain';
import { PortalVideoActions } from './portal-video-actions';
import { PortalQuoteActions } from './portal-quote-actions';
import { cn } from '@/lib/utils/cn';
import {
  getStatusBlockSurface,
  portalInvoiceStatusToTone,
  portalQuoteStatusToTone,
  portalVideoPublicStatusToTone,
} from '@/lib/ui/status-block-tone';
import { buildPortalCalendarEvents } from '@/lib/portal/calendar-events';
import { PortalClientCalendar } from './portal-client-calendar';

export const metadata: Metadata = {
  title: 'Espace client',
  robots: { index: false, follow: false },
};

function PortalMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <p className="font-serif text-xl text-foreground">{title}</p>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export default async function ClientPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams?: Promise<{ token?: string }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;
  const token = sp?.token;

  const validation = await validatePortalToken(clientId, token);
  if (!validation.ok) {
    const copy: Record<string, { title: string; body: string }> = {
      missing_token: {
        title: 'Lien incomplet',
        body: 'Ajoutez le paramètre token fourni par votre chargé de compte.',
      },
      invalid: { title: 'Lien invalide', body: 'Ce lien ne correspond pas à un accès actif.' },
      inactive: { title: 'Portail désactivé', body: 'Votre espace est temporairement fermé. Contactez l’agence.' },
      expired: { title: 'Lien expiré', body: 'Demandez un nouveau lien sécurisé à votre interlocuteur Supra v.' },
    };
    const m = copy[validation.reason];
    return <PortalMessage title={m.title} body={m.body} />;
  }

  await recordPortalAccess(validation.portal.id);

  const [bundle, quota] = await Promise.all([
    loadPortalPublicData(clientId),
    getMonthlyVideoDeliverySnapshot(clientId),
  ]);

  if (!bundle) {
    return <PortalMessage title="Erreur" body="Impossible de charger votre espace pour le moment." />;
  }

  const pendingVideos = bundle.videos.filter(
    (v) =>
      v.public_status === 'in_validation' ||
      v.status === 'sent_to_client' ||
      v.status === 'internal_review'
  );

  const safeToken = token!;

  return (
    <div className="space-y-10">
      <header className="border-b border-border/80 pb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">Supra v.</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-foreground">{bundle.client.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Votre espace sécurisé — données visibles uniquement par vous.</p>
      </header>

      {quota.quota > 0 ? (
        <section className={cn('p-6', getStatusBlockSurface('neutral'), 'ring-1 ring-primary/15')}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Quota vidéo (mois en cours)</h2>
          <p className="mt-2 font-sans text-2xl font-semibold tabular-nums text-foreground">
            {quota.deliveredThisMonth} / {quota.quota}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Livrées validées ou publiées sur la période.</p>
        </section>
      ) : null}

      {pendingVideos.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Validations en attente</h2>
          <ul className="mt-3 space-y-3">
            {pendingVideos.map((v) => (
              <li key={v.id} className={cn('p-4', getStatusBlockSurface('warning', { urgentGlow: true }))}>
                <p className="font-medium text-foreground">{v.title}</p>
                <p className="text-xs text-muted-foreground">{VIDEO_PUBLIC_STATUS_MAP[v.public_status].label}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="scroll-mt-6 space-y-4" id="portal-section-videos">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Vidéos</h2>
        <ul className="mt-4 space-y-4">
          {bundle.videos.length === 0 ? (
            <li className="text-sm text-muted-foreground">Aucune vidéo à afficher pour le moment.</li>
          ) : (
            bundle.videos.map((v) => (
              <li
                key={v.id}
                id={`portal-video-${v.id}`}
                className={cn('scroll-mt-6 p-4', getStatusBlockSurface(portalVideoPublicStatusToTone(v.public_status)))}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{v.title}</p>
                    <p className="text-xs text-muted-foreground">{VIDEO_PUBLIC_STATUS_MAP[v.public_status].label}</p>
                    {v.delivery_deadline ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Échéance {format(new Date(v.delivery_deadline), 'd MMMM yyyy', { locale: fr })}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {v.preview_url ? (
                    <a
                      href={v.preview_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Voir l’aperçu
                    </a>
                  ) : null}
                  {v.final_url ? (
                    <a
                      href={v.final_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Lien final
                    </a>
                  ) : null}
                </div>
                <PortalVideoActions clientId={clientId} token={safeToken} video={v} />
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="scroll-mt-6 space-y-4" id="portal-section-projects">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Projets</h2>
        <ul className="mt-4 space-y-2">
          {bundle.projects.length === 0 ? (
            <li className="text-sm text-muted-foreground">—</li>
          ) : (
            bundle.projects.map((p) => (
              <li
                key={p.id}
                id={`portal-project-${p.id}`}
                className={cn('scroll-mt-4 px-3 py-2 text-sm', getStatusBlockSurface('muted'))}
              >
                <span className="text-foreground">{p.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{p.status}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="scroll-mt-6 space-y-4" id="portal-section-quotes">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Propositions commerciales</h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Vos devis visibles ici : montants publics uniquement. Aucune note interne n&apos;est affichée. Pour une
          proposition au statut « Envoyé », vous pouvez accepter ou refuser en ligne ; le PDF reste la référence
          contractuelle.
        </p>
        <ul className="mt-4 space-y-4">
          {bundle.quotes.length === 0 ? (
            <li className="text-sm text-muted-foreground">Aucune proposition partagée pour le moment.</li>
          ) : (
            bundle.quotes.map((q) => {
              const pdfHref = `/api/portal/quotes/${q.id}/pdf?clientId=${encodeURIComponent(clientId)}&token=${encodeURIComponent(safeToken)}`;
              const label = (q.proposal_title ?? '').trim() || q.ref;
              return (
                <li
                  key={q.id}
                  id={`portal-quote-${q.id}`}
                  className={cn('scroll-mt-6 p-5', getStatusBlockSurface(portalQuoteStatusToTone(q.status)))}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug text-foreground">{label}</p>
                      {q.package_name ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{q.package_name}</p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground/90">{QUOTE_STATUS_MAP[q.status].label}</span>
                        {' · '}
                        valide jusqu&apos;au {format(new Date(q.valid_until), 'd MMMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total TTC</p>
                      <p className="mt-1 tabular-nums text-base font-semibold text-foreground">
                        {q.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {q.currency}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
                    <a
                      href={pdfHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                    >
                      Télécharger / imprimer le PDF
                    </a>
                  </div>
                  <PortalQuoteActions quoteId={q.id} clientId={clientId} token={safeToken} status={q.status} />
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="scroll-mt-6 space-y-4" id="portal-section-invoices">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Factures</h2>
        <ul className="mt-4 space-y-2">
          {bundle.invoices.length === 0 ? (
            <li className="text-sm text-muted-foreground">—</li>
          ) : (
            bundle.invoices.map((inv) => (
              <li
                key={inv.id}
                id={`portal-invoice-${inv.id}`}
                className={cn(
                  'scroll-mt-4 flex min-h-[48px] flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm sm:py-2',
                  getStatusBlockSurface(portalInvoiceStatusToTone(inv.status)),
                )}
              >
                <span className="text-foreground">{inv.ref}</span>
                <span className="tabular-nums text-muted-foreground">
                  {inv.total} {inv.currency} · {INVOICE_STATUS_MAP[inv.status].label}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="scroll-mt-6 space-y-4" id="portal-section-documents">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Documents</h2>
        <ul className="mt-4 space-y-2">
          {bundle.documents.length === 0 ? (
            <li className="text-sm text-muted-foreground">—</li>
          ) : (
            bundle.documents.map((d) => {
              const href = d.file_storage_path
                ? `/api/portal/documents/${d.id}/download?clientId=${encodeURIComponent(clientId)}&token=${encodeURIComponent(safeToken)}`
                : d.file_url || d.external_link;
              return (
                <li
                  key={d.id}
                  id={`portal-document-${d.id}`}
                  className={cn(
                    'scroll-mt-4 flex min-h-[48px] flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between',
                    getStatusBlockSurface('info'),
                    'px-3 py-3 sm:py-2',
                  )}
                >
                  <span className="text-foreground">{d.name}</span>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-0 mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-primary hover:underline sm:ml-2 sm:mt-0 sm:text-xs sm:font-medium"
                    >
                      {d.file_storage_path ? 'Télécharger' : 'Ouvrir'}
                    </a>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="scroll-mt-6 space-y-4" id="portal-section-reports">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Rapports</h2>
        <ul className="mt-4 space-y-3">
          {bundle.reports.length === 0 ? (
            <li className="text-sm text-muted-foreground">—</li>
          ) : (
            bundle.reports.map((r) => {
              const pdfHref = `/api/portal/reports/${r.id}/pdf?clientId=${encodeURIComponent(clientId)}&token=${encodeURIComponent(safeToken)}`;
              return (
                <li
                  key={r.id}
                  id={`portal-report-${r.id}`}
                  className={cn('scroll-mt-6 p-4 text-sm sm:p-3', getStatusBlockSurface('neutral'))}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-foreground">{r.title}</p>
                    <a
                      href={pdfHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[44px] shrink-0 items-center text-sm font-semibold text-primary hover:underline sm:text-xs"
                    >
                      PDF
                    </a>
                  </div>
                  {r.summary ? <p className="mt-2 text-muted-foreground">{r.summary}</p> : null}
                  {r.next_actions ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="text-primary">Suite :</span> {r.next_actions}
                    </p>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
