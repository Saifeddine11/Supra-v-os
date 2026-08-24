import type { Metadata } from 'next';
import Link from 'next/link';
import { requireClientAuth } from '@/lib/clients/session';
import { loadClientOverview } from '@/lib/clients/workspace-data';
import { firstNameFromFullName } from '@/lib/clients/client-labels';
import {
  ClientActivityList,
  ClientAttentionList,
  ClientEmpty,
  ClientFinanceBlock,
  ClientInvoiceTable,
  ClientMetricRow,
  ClientPipeline,
  ClientProjectList,
  ClientSectionTitle,
  ClientSurface,
} from '@/components/client-workspace/client-ui';

export const metadata: Metadata = { title: 'Espace client' };

export default async function ClientOverviewPage() {
  const session = await requireClientAuth();
  const data = await loadClientOverview(session);
  const first = firstNameFromFullName(session.fullName);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="font-serif text-3xl tracking-tight text-foreground">
          {first ? `Bonjour, ${first}` : 'Bonjour'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Voici où en sont vos projets avec Supra
          {data.profile.name ? ` · ${data.profile.name}` : ''}.
        </p>
      </header>

      <ClientMetricRow metrics={data.metrics} />

      <ClientSurface>
        <ClientSectionTitle title="À valider" hint="Les actions qui nécessitent votre regard." />
        <ClientAttentionList items={data.attention} />
      </ClientSurface>

      <ClientSurface>
        <div className="mb-4 flex items-end justify-between gap-3">
          <ClientSectionTitle title="Projets actifs" className="mb-0" />
          <Link href="/client/projects" className="text-xs font-semibold text-primary hover:underline">
            Tous les projets
          </Link>
        </div>
        <ClientProjectList
          projects={data.activeProjects}
          empty="Aucun projet actif pour le moment."
        />
      </ClientSurface>

      <ClientSurface>
        <div className="mb-4 flex items-end justify-between gap-3">
          <ClientSectionTitle title="Pipeline contenu" hint="Où en est chaque vidéo." className="mb-0" />
          <Link href="/client/videos" className="text-xs font-semibold text-primary hover:underline">
            Toutes les vidéos
          </Link>
        </div>
        {data.videos.length === 0 ? (
          <ClientEmpty title="Aucun contenu en production pour le moment." />
        ) : (
          <ClientPipeline videos={data.videos} />
        )}
      </ClientSurface>

      <div className="grid gap-8 lg:grid-cols-2">
        <ClientSurface>
          <div className="mb-4 flex items-end justify-between gap-3">
            <ClientSectionTitle title="À venir" className="mb-0" />
            <Link href="/client/planning" className="text-xs font-semibold text-primary hover:underline">
              Planning
            </Link>
          </div>
          {data.upcoming.today.length + data.upcoming.week.length + data.upcoming.later.length === 0 ? (
            <ClientEmpty title="Rien de planifié pour les prochaines semaines." />
          ) : (
            <div className="space-y-5">
              <UpcomingGroup title="Aujourd’hui" items={data.upcoming.today} />
              <UpcomingGroup title="Cette semaine" items={data.upcoming.week} />
              <UpcomingGroup title="Plus tard" items={data.upcoming.later} />
            </div>
          )}
        </ClientSurface>

        <ClientSurface>
          <ClientSectionTitle title="Activité récente" />
          <ClientActivityList items={data.activity} />
        </ClientSurface>
      </div>

      <ClientSurface>
        <div className="mb-4 flex items-end justify-between gap-3">
          <ClientSectionTitle title="Situation financière" className="mb-0" />
          <Link href="/client/invoices" className="text-xs font-semibold text-primary hover:underline">
            Factures
          </Link>
        </div>
        <ClientFinanceBlock finance={data.finance} />
        {data.recentInvoices.length > 0 ? (
          <div className="mt-5">
            <ClientInvoiceTable invoices={data.recentInvoices} empty="" />
          </div>
        ) : null}
      </ClientSurface>
    </div>
  );
}

function UpcomingGroup({
  title,
  items,
}: {
  title: string;
  items: { id: string; title: string; subtitle: string; meta: string | null; href: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-2">
        {items.slice(0, 4).map((e) => (
          <li key={e.id}>
            <Link href={e.href} className="block rounded-lg px-1 py-1 hover:bg-white/[0.03]">
              <p className="text-sm text-foreground">{e.title}</p>
              <p className="text-xs text-muted-foreground">
                {e.subtitle}
                {e.meta ? ` · ${e.meta}` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
