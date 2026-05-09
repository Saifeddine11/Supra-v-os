import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getProjectDetail } from '@/lib/data/projects';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForSelect } from '@/lib/data/employees';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageProjects } from '@/lib/auth/capabilities';
import {
  PROJECT_STATUS_MAP,
  PRIORITY_MAP,
  INVOICE_STATUS_MAP,
  TASK_STATUS_MAP,
  DOCUMENT_TYPE_LABELS,
} from '@/types/domain';
import { formatProjectType } from '@/lib/utils/project-labels';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { ProgressBar } from '@/components/shared/progress-bar';
import { ProjectFormDialog } from '../project-form-dialog';
import { Button } from '@/components/ui/button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ctx = await getAuthContext();
  const bundle = await getProjectDetail(id, ctx);
  return { title: bundle?.project.title ?? 'Projet' };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext();
  const [bundle, clients, employees] = await Promise.all([
    getProjectDetail(id, ctx),
    listClients({}, ctx),
    listEmployeesForSelect(ctx),
  ]);
  if (!bundle) notFound();

  const { project, tasks, documents, invoices, activity } = bundle;
  const canEdit = canManageProjects(ctx?.role ?? null);
  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));
  const st = PROJECT_STATUS_MAP[project.status];
  const pr = PRIORITY_MAP[project.priority];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/projects" className="text-xs font-medium text-primary hover:underline">
            ← Projets
          </Link>
          <h1 className="mt-2 font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {project.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{st.label}</Badge>
            <span className="text-sm text-muted-foreground">{formatProjectType(project.type)}</span>
            <span className="text-sm text-muted-foreground">· {pr.label}</span>
            {project.clients ? (
              <Link href={`/clients/${project.clients.id}`} className="text-sm font-medium text-primary hover:underline">
                {project.clients.name}
              </Link>
            ) : null}
          </div>
        </div>
        {canEdit ? (
          <ProjectFormDialog
            clients={clientOpts}
            employees={employees}
            project={project}
            trigger={<Button variant="outline" className="rounded-full">Modifier</Button>}
          />
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Avancement" description="Synthèse mandat" className="lg:col-span-2">
          <div className="space-y-4">
            <ProgressBar value={project.progress} />
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Chef de projet</dt>
                <dd className="text-foreground">{project.lead_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Échéance</dt>
                <dd className="text-foreground">{project.deadline ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Budget</dt>
                <dd className="text-foreground">
                  {project.budget != null ? project.budget.toLocaleString('fr-FR') : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Début</dt>
                <dd className="text-foreground">{project.start_date ?? '—'}</dd>
              </div>
            </dl>
            {project.description ? (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            ) : null}
          </div>
        </SectionCard>
        <SectionCard title="Notes internes" description="Non visibles côté client">
          <p className="text-sm text-muted-foreground">{project.notes_internal ?? 'Aucune note.'}</p>
        </SectionCard>
      </div>

      <SectionCard title={`Tâches liées (${tasks.length})`} description="Flux opérationnel">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune tâche rattachée à ce projet.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/tasks?highlight=${t.id}`} className="font-medium text-foreground hover:text-primary">
                    {t.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{TASK_STATUS_MAP[t.status].label}</p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t.deadline
                    ? format(new Date(t.deadline), 'd MMM yyyy', { locale: fr })
                    : 'Sans date'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={`Documents (${documents.length})`}>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun document lié.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {documents.map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <span className="text-foreground">{d.name}</span>
                  <span className="text-xs text-muted-foreground">{DOCUMENT_TYPE_LABELS[d.type]}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title={`Factures (${invoices.length})`}>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune facture sur ce projet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex justify-between gap-2">
                  <span className="font-mono text-foreground">{inv.ref}</span>
                  <Badge variant="outline" className="font-normal">
                    {INVOICE_STATUS_MAP[inv.status].label}
                  </Badge>
                  <span className="tabular-nums text-muted-foreground">
                    {inv.total.toLocaleString('fr-FR')} {inv.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Journal récent" description="Activité enregistrée sur le projet">
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas encore d&apos;entrées d&apos;audit.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="border-l-2 border-primary/35 pl-3">
                <p className="font-medium text-foreground">{a.action}</p>
                <p className="text-xs text-muted-foreground">
                  {a.actor_label ?? 'Système'} ·{' '}
                  {format(new Date(a.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
