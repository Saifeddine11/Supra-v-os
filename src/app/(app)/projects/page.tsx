import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listProjectsWithStats, type ProjectListFilters } from '@/lib/data/projects';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForSelect } from '@/lib/data/employees';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageProjects } from '@/lib/auth/capabilities';
import { PROJECT_STATUS_MAP, PRIORITY_MAP } from '@/types/domain';
import { formatProjectType } from '@/lib/utils/project-labels';
import type { ProjectStatus, TaskPriority } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ProgressBar } from '@/components/shared/progress-bar';
import { ProjectsToolbar } from './projects-toolbar';
import { ProjectRowActions } from './project-row-actions';
import { ProjectFormDialog } from './project-form-dialog';

export const metadata: Metadata = { title: 'Projets clients' };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    type?: string;
    client?: string;
    priority?: string;
  }>;
}) {
  const ctx = await getAuthContext();
  const sp = await searchParams;
  const filters: ProjectListFilters = {
    search: sp?.q,
    status: (sp?.status === 'all' || !sp?.status ? 'all' : sp.status) as ProjectStatus | 'all',
    type: sp?.type === 'all' || !sp?.type ? 'all' : sp.type,
    clientId: sp?.client === 'all' || !sp?.client ? 'all' : sp.client,
    priority: (sp?.priority === 'all' || !sp?.priority ? 'all' : sp.priority) as TaskPriority | 'all',
  };

  const [rows, clients, employees] = await Promise.all([
    listProjectsWithStats(filters, ctx),
    listClients({}, ctx),
    listEmployeesForSelect(ctx),
  ]);

  const canEdit = canManageProjects(ctx?.role ?? null);
  const isAdmin = ctx?.role === 'admin';
  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Projets clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilotage des mandats — liés clients, équipe, facturation et production.
          </p>
        </div>
        {canEdit ? (
          <ProjectFormDialog
            clients={clientOpts}
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

      <ProjectsToolbar
        clients={clientOpts}
        defaultQ={sp?.q}
        defaultStatus={sp?.status ?? 'all'}
        defaultType={sp?.type ?? 'all'}
        defaultClient={sp?.client ?? 'all'}
        defaultPriority={sp?.priority ?? 'all'}
      />

      <SectionCard title="Portefeuille projets" description={`${rows.length} projet(s) affiché(s)`}>
        {rows.length === 0 ? (
          <EmptyState
            title="Aucun projet"
            description="Créez un projet ou ajustez les filtres pour voir vos mandats."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Projet</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Priorité</th>
                  <th className="px-4 py-3 font-medium">Avancement</th>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Échéance</th>
                  <th className="px-4 py-3 font-medium text-center">Tâches</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((p) => {
                  const st = PROJECT_STATUS_MAP[p.status];
                  const pr = PRIORITY_MAP[p.priority];
                  return (
                    <tr key={p.id} className="bg-card/40 transition-colors hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <Link href={`/projects/${p.id}`} className="font-medium text-foreground hover:text-primary">
                          {p.title}
                        </Link>
                        {p.budget != null ? (
                          <p className="text-xs text-muted-foreground">
                            Budget {p.budget.toLocaleString('fr-FR')} · {p.invoice_count} fact.
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {p.invoice_count} fact. · {p.videos_for_client} vidéos client
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.clients ? (
                          <Link href={`/clients/${p.clients.id}`} className="text-muted-foreground hover:text-primary">
                            {p.clients.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatProjectType(p.type)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-normal">
                          {st.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{pr.label}</span>
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <ProgressBar value={p.progress} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.lead_name ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.deadline ?? '—'}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">{p.task_count}</td>
                      <td className="px-4 py-3 text-right">
                        <ProjectRowActions project={p} canEdit={canEdit} isAdmin={isAdmin} />
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
