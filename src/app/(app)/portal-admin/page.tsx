import type { Metadata } from 'next';
import { listPortalAdminRows, type PortalAdminFilters } from '@/lib/data/portal-admin';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageClientPortal } from '@/lib/auth/capabilities';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { PortalAdminToolbar } from './portal-admin-toolbar';
import { PortalAdminRow } from './portal-admin-row';

export const metadata: Metadata = { title: 'Administration portail' };

export default async function PortalAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; state?: string }>;
}) {
  const ctx = await getAuthContext();
  const canManage = canManageClientPortal(ctx?.role ?? null);
  const sp = await searchParams;
  const filters: PortalAdminFilters = {
    search: sp?.q,
    state: (sp?.state === 'all' || !sp?.state ? 'all' : sp.state) as PortalAdminFilters['state'],
  };

  const rows = await listPortalAdminRows(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Portail clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jetons, visibilité et volumétrie des contenus exposés — actions réservées admin / chef de projet.
        </p>
      </div>

      <PortalAdminToolbar defaultQ={sp?.q} defaultState={sp?.state ?? 'all'} />

      <SectionCard title="Clients" description={`${rows.length} ligne(s)`}>
        {rows.length === 0 ? (
          <EmptyState title="Aucun client" description="Élargissez les filtres." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Portail</th>
                  <th className="px-4 py-3 font-medium">Devis visibles</th>
                  <th className="px-4 py-3 font-medium">Documents</th>
                  <th className="px-4 py-3 font-medium">Rapports</th>
                  <th className="px-4 py-3 font-medium">Validations en attente</th>
                  <th className="px-4 py-3 font-medium">Dernier accès</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => (
                  <PortalAdminRow key={row.client.id} row={row} canManage={canManage} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
