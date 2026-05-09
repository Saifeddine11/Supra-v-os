import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listInternalProjectsWithStats, type InternalProjectListFilters } from '@/lib/data/internal-projects';
import { listEmployeesForSelect } from '@/lib/data/employees';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageProjects } from '@/lib/auth/capabilities';
import { PROJECT_STATUS_MAP, INTERNAL_PRIORITY_MAP } from '@/types/domain';
import type { InternalPriority, ProjectStatus } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ProgressBar } from '@/components/shared/progress-bar';
import { InternalProjectsToolbar } from './internal-toolbar';
import { InternalProjectRowActions } from './internal-row-actions';
import { InternalProjectFormDialog } from './internal-form-dialog';

export const metadata: Metadata = { title: 'Projets internes' };

export default async function InternalProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; owner?: string; priority?: string }>;
}) {
  const ctx = await getAuthContext();
  const sp = await searchParams;
  const filters: InternalProjectListFilters = {
    search: sp?.q,
    status: (sp?.status === 'all' || !sp?.status ? 'all' : sp.status) as ProjectStatus | 'all',
    ownerId: sp?.owner === 'all' || !sp?.owner ? 'all' : sp.owner,
    priority: (sp?.priority === 'all' || !sp?.priority ? 'all' : sp.priority) as InternalPriority | 'all',
  };

  const [rows, employees] = await Promise.all([
    listInternalProjectsWithStats(filters),
    listEmployeesForSelect(ctx),
  ]);
  const canEdit = canManageProjects(ctx?.role ?? null);
  const isAdmin = ctx?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Projets internes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Roadmap Supra v. — site, SEO, réseaux, automatisations, partenariats.
          </p>
        </div>
        {canEdit ? (
          <InternalProjectFormDialog
            employees={employees}
            trigger={
              <Button variant="primary" className="rounded-full">
                <Plus className="h-4 w-4" />
                Nouveau projet
              </Button>
            }
          />
        ) : null}
      </div>

      <InternalProjectsToolbar
        employees={employees}
        defaultQ={sp?.q}
        defaultStatus={sp?.status ?? 'all'}
        defaultOwner={sp?.owner ?? 'all'}
        defaultPriority={sp?.priority ?? 'all'}
      />

      <SectionCard title="Roadmap interne" description={`${rows.length} initiative(s)`}>
        {rows.length === 0 ? (
          <EmptyState title="Aucun projet interne" description="Créez une initiative ou élargissez les filtres." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Projet</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Priorité</th>
                  <th className="px-4 py-3 font-medium">Avancement</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Échéance</th>
                  <th className="px-4 py-3 text-center font-medium">Tâches</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((p) => {
                  const st = PROJECT_STATUS_MAP[p.status];
                  const pr = INTERNAL_PRIORITY_MAP[p.priority];
                  return (
                    <tr key={p.id} className="bg-card/40 transition-colors hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <Link href={`/internal/${p.id}`} className="font-medium text-foreground hover:text-primary">
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.category ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-normal">
                          {st.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{pr.label}</td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <ProgressBar value={p.progress} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.owner_name ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.deadline ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{p.task_count}</td>
                      <td className="px-4 py-3 text-right">
                        <InternalProjectRowActions project={p} canEdit={canEdit} isAdmin={isAdmin} />
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
