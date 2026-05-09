import type { Metadata } from 'next';
import Link from 'next/link';
import { getAuthContext } from '@/lib/auth/permissions';
import { canDeleteClient, canModifyClients } from '@/lib/auth/capabilities';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForSelect } from '@/lib/data/employees';
import { CLIENT_STATUS_MAP } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ClientsToolbar } from './clients-toolbar';
import { ClientRowActions } from './client-row-actions';
import type { ClientStatus } from '@/types/database';

export const metadata: Metadata = { title: 'Clients' };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await getAuthContext();
  const sp = await searchParams;
  const q = sp?.q;
  const statusParam = sp?.status ?? 'all';
  const status =
    statusParam === 'all' || !statusParam
      ? 'all'
      : (statusParam as ClientStatus);

  const [clients, employees] = await Promise.all([
    listClients({ search: q, status }, ctx),
    listEmployeesForSelect(ctx),
  ]);

  const canEdit = canModifyClients(ctx?.role ?? null);
  const canDelete = canDeleteClient(ctx?.role ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Portefeuille clients — données Supabase en temps réel (RLS appliqué).
        </p>
      </div>

      <ClientsToolbar
        employees={employees}
        canCreate={canEdit}
        defaultQ={q}
        defaultStatus={statusParam}
      />

      <SectionCard title="Liste" description={`${clients.length} client(s) affiché(s)`}>
        {clients.length === 0 ? (
          <EmptyState
            title="Aucun client"
            description="Ajustez les filtres ou créez un nouveau compte client pour démarrer."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Secteur</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {clients.map((c) => {
                  const st = CLIENT_STATUS_MAP[c.status];
                  return (
                    <tr key={c.id} className="bg-card/40 transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/clients/${c.id}`} className="font-medium text-foreground hover:text-primary">
                          {c.name}
                        </Link>
                        {c.city ? (
                          <p className="text-xs text-muted-foreground">{c.city}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.sector}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="border-border">
                          {st.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.email ?? '—'}
                        {c.phone ? <span className="block text-xs">{c.phone}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ClientRowActions client={c} employees={employees} canEdit={canEdit} canDelete={canDelete} />
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
