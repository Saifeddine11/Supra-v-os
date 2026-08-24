import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClientById } from '@/lib/data/clients';
import { getClientRelations } from '@/lib/data/client-detail';
import { listEmployeesForSelect } from '@/lib/data/employees';
import { getAuthContext } from '@/lib/auth/permissions';
import {
  canDeleteClient,
  canManageClientPortal,
  canModifyClients,
  canViewClientContractFinancials,
  canViewInvoices,
} from '@/lib/auth/capabilities';
import {
  CLIENT_STATUS_MAP,
  INVOICE_STATUS_MAP,
  VIDEO_PUBLIC_STATUS_MAP,
  VIDEO_STATUS_MAP,
} from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { ClientDetailActions } from '../client-detail-actions';
import { PortalManagementSection } from '../portal-management';
import { ClientAccessSection } from '../client-access-section';
import {
  ClientUsersTableMissingError,
  listClientUsersForClient,
} from '@/lib/clients/auth-provision';
import { ProgressBar } from '@/components/shared/progress-bar';
import { listActivityForEntity } from '@/lib/data/activity-logs';
import { EntityActivityFeed } from '@/components/activity/entity-activity-feed';
import { DocumentPortalVisibilityButton } from '@/components/documents/document-portal-visibility-button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getAgencyDisplayCurrency } from '@/lib/data/agency-settings-db';
import { formatAgencyMoneyCompact } from '@/lib/money/format-money';
import { getClientAccent, getSoftBackgroundColor } from '@/lib/ui/client-colors';
import { ClientColorDot } from '@/components/shared/client-color-dot';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ctx = await getAuthContext();
  const client = await getClientById(id, ctx);
  return { title: client ? client.name : 'Client' };
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let clientActivity: Awaited<ReturnType<typeof listActivityForEntity>> = [];
  try {
    clientActivity = await listActivityForEntity('client', id, 25);
  } catch {
    clientActivity = [];
  }

  const ctx = await getAuthContext();
  const [client, bundle, employees, agencyCurrency] = await Promise.all([
    getClientById(id, ctx),
    getClientRelations(id, ctx),
    listEmployeesForSelect(ctx),
    getAgencyDisplayCurrency(),
  ]);

  if (!client) notFound();

  const canEdit = canModifyClients(ctx?.role ?? null);
  const canDelete = canDeleteClient(ctx?.role ?? null);
  const canPortal = canManageClientPortal(ctx?.role ?? null);

  let clientUsers: Awaited<ReturnType<typeof listClientUsersForClient>> = [];
  let clientUsersLoadError: string | null = null;
  if (canPortal) {
    try {
      clientUsers = await listClientUsersForClient(id);
    } catch (e) {
      clientUsersLoadError =
        e instanceof ClientUsersTableMissingError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Impossible de charger les accès client.';
    }
  }
  const showContractFinancials = canViewClientContractFinancials(ctx?.role ?? null);
  const showInvoices = canViewInvoices(ctx?.role ?? null);
  const st = CLIENT_STATUS_MAP[client.status];

  const clientAccent = getClientAccent({ name: client.name, color_hex: client.color_hex });
  const roadmaps = bundle.documents
    .filter((d) => d.type === 'roadmap')
    .sort((a, b) => {
      const ad = a.period_start ?? a.uploaded_at;
      const bd = b.period_start ?? b.uploaded_at;
      return bd.localeCompare(ad);
    });
  const otherDocuments = bundle.documents.filter((d) => d.type !== 'roadmap');

  return (
    <div className="space-y-8">
      <div
        className="rounded-2xl border border-border/70 px-4 py-4 sm:px-5"
        style={{
          borderColor: `${clientAccent.color}40`,
          background: getSoftBackgroundColor(clientAccent.color, 0.08),
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/clients" className="text-xs font-medium text-primary hover:underline">
            ← Clients
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-2 font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <ClientColorDot hex={clientAccent.color} size="md" className="h-3 w-3 sm:h-3.5 sm:w-3.5" title={client.name} />
            {client.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{st.label}</Badge>
            <span className="text-sm text-muted-foreground">{client.sector}</span>
            {client.city ? (
              <span className="text-sm text-muted-foreground">· {client.city}</span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClientDetailActions
            client={client}
            employees={employees}
            defaultAgencyCurrency={agencyCurrency}
            showContractFinancials={showContractFinancials}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Coordonnées" description="Contact et informations générales.">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Contact principal</dt>
              <dd className="text-foreground">{client.primary_contact ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">E-mail</dt>
              <dd className="text-foreground">{client.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Téléphone</dt>
              <dd className="text-foreground">{client.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Services actifs</dt>
              <dd className="text-foreground">
                {client.services?.length ? client.services.join(', ') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {showContractFinancials ? 'Forfait / quota' : 'Quota production'}
              </dt>
              <dd className="text-foreground">
                {showContractFinancials
                  ? `${client.monthly_fee} ${client.currency} · ${client.monthly_video_quota} vidéos / mois`
                  : `${client.monthly_video_quota} vidéos / mois`}
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Portail client"
          description="Lien sécurisé pour vos clients — réservé admin / chef de projet."
        >
          {canPortal ? (
            <>
              {bundle.portal ? (
                <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Statut</dt>
                    <dd>{bundle.portal.is_active ? 'Actif' : 'Inactif'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Visites</dt>
                    <dd className="tabular-nums">{bundle.portal.access_count}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Expiration</dt>
                    <dd>
                      {bundle.portal.expires_at
                        ? new Date(bundle.portal.expires_at).toLocaleDateString('fr-FR')
                        : '—'}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mb-4 text-sm text-muted-foreground">Aucun portail — générez un premier jeton.</p>
              )}
              <PortalManagementSection clientId={id} portal={bundle.portal} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Seuls l’administrateur et le chef de projet peuvent gérer le portail client.
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Accès client"
        description="Comptes de connexion pour ce client — distincts de l’équipe interne."
      >
        {canPortal ? (
          <ClientAccessSection
            clientId={id}
            users={clientUsers}
            loadError={clientUsersLoadError}
            defaultFullName={client.primary_contact ?? client.name}
            defaultEmail={client.email ?? ''}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Seuls l’administrateur et le chef de projet peuvent gérer les accès client.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Notes internes" description="Visible uniquement côté équipe.">
        <p className="whitespace-pre-wrap text-sm text-foreground">{client.notes_internal ?? '—'}</p>
      </SectionCard>

      <SectionCard title="Projets liés" description={`${bundle.projects.length} projet(s)`}>
        {bundle.projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun projet pour ce client.</p>
        ) : (
          <ul className="space-y-3">
            {bundle.projects.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-border/80 bg-muted/50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{p.title}</p>
                  <Badge variant="outline">{p.type}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar value={p.progress} className="flex-1" />
                  <span className="text-xs tabular-nums text-muted-foreground">{p.progress}%</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Vidéos" description={`${bundle.videos.length} vidéo(s)`}>
        {bundle.videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune vidéo.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {bundle.videos.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <Link href="/videos" className="font-medium text-foreground hover:text-primary">
                    {v.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{VIDEO_STATUS_MAP[v.status].label}</p>
                </div>
                <Badge variant="primary">{VIDEO_PUBLIC_STATUS_MAP[v.public_status].label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Roadmaps mensuelles" description={`${roadmaps.length} document(s) type roadmap`}>
        {roadmaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune roadmap enregistrée pour ce client.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {roadmaps.map((d) => {
              const href = d.file_storage_path
                ? `/api/documents/${d.id}/download`
                : d.file_url || d.external_link;
              const periodLabel =
                d.period_start && d.period_end
                  ? format(new Date(d.period_start), 'MMMM yyyy', { locale: fr })
                  : null;
              return (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {periodLabel ? `Mois : ${periodLabel}` : 'Période non renseignée'}
                      {' · '}
                      Portail : {d.visible_to_client ? 'visible' : 'masqué'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {href ? (
                      <a
                        href={href}
                        className="text-xs font-semibold text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Voir / télécharger
                      </a>
                    ) : null}
                    {canEdit ? (
                      <DocumentPortalVisibilityButton
                        documentId={d.id}
                        visible={d.visible_to_client}
                        canModify={canEdit}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {canEdit ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Créez une roadmap depuis{' '}
            <Link href="/documents" className="font-medium text-primary hover:underline">
              Documents
            </Link>{' '}
            (type Roadmap, mois couvert, PDF ou lien https).
          </p>
        ) : null}
      </SectionCard>

      {showInvoices ? (
      <SectionCard title="Factures" description={`${bundle.invoices.length} facture(s)`}>
        {bundle.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune facture.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {bundle.invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <Link href="/invoices" className="font-medium hover:text-primary">
                    {inv.ref}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Échéance {new Date(inv.due_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">
                    {formatAgencyMoneyCompact(Number(inv.total), agencyCurrency)}
                  </p>
                  <Badge variant="outline" className="mt-1">
                    {INVOICE_STATUS_MAP[inv.status].label}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      ) : null}

      <SectionCard title="Documents" description={`${otherDocuments.length} fichier(s) (hors roadmaps)`}>
        {otherDocuments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun autre document indexé.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {otherDocuments.map((d) => {
              const href = d.file_storage_path
                ? `/api/documents/${d.id}/download`
                : d.file_url || d.external_link;
              return (
                <li key={d.id} className="flex justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-foreground">{d.name}</span>
                  {href ? (
                    <a href={href} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                      {d.file_storage_path ? 'Télécharger' : 'Ouvrir'}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Activité" description="Actions enregistrées côté serveur pour ce client.">
        <EntityActivityFeed logs={clientActivity} />
      </SectionCard>
    </div>
  );
}
