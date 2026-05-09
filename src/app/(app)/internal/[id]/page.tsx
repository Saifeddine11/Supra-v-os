import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getInternalProjectDetail } from '@/lib/data/internal-projects';
import { listEmployeesForSelect } from '@/lib/data/employees';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageProjects } from '@/lib/auth/capabilities';
import { PROJECT_STATUS_MAP, INTERNAL_PRIORITY_MAP, TASK_STATUS_MAP } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { ProgressBar } from '@/components/shared/progress-bar';
import { InternalProjectFormDialog } from '../internal-form-dialog';
import { Button } from '@/components/ui/button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const d = await getInternalProjectDetail(id);
  return { title: d?.project.title ?? 'Projet interne' };
}

export default async function InternalProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext();
  const [bundle, employees] = await Promise.all([
    getInternalProjectDetail(id),
    listEmployeesForSelect(ctx),
  ]);
  if (!bundle) notFound();

  const { project, tasks } = bundle;
  const canEdit = canManageProjects(ctx?.role ?? null);
  const st = PROJECT_STATUS_MAP[project.status];
  const pr = INTERNAL_PRIORITY_MAP[project.priority];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/internal" className="text-xs font-medium text-primary hover:underline">
            ← Projets internes
          </Link>
          <h1 className="mt-2 font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {project.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{st.label}</Badge>
            <span className="text-sm text-muted-foreground">{pr.label}</span>
            {project.category ? (
              <span className="text-sm text-muted-foreground">· {project.category}</span>
            ) : null}
          </div>
        </div>
        {canEdit ? (
          <InternalProjectFormDialog
            employees={employees}
            project={project}
            trigger={<Button variant="outline" className="rounded-full">Modifier</Button>}
          />
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Vue d’ensemble" className="lg:col-span-2">
          <div className="space-y-4">
            <ProgressBar value={project.progress} />
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Owner</dt>
                <dd className="text-foreground">{project.owner_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Échéance</dt>
                <dd className="text-foreground">{project.deadline ?? '—'}</dd>
              </div>
            </dl>
            {project.description ? (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            ) : null}
          </div>
        </SectionCard>
        <SectionCard title="Notes">
          <p className="text-sm text-muted-foreground">{project.notes ?? '—'}</p>
        </SectionCard>
      </div>

      <SectionCard title={`Tâches (${tasks.length})`}>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune tâche liée.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-medium text-foreground">{t.title}</span>
                  <p className="text-xs text-muted-foreground">{TASK_STATUS_MAP[t.status].label}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t.deadline
                    ? format(new Date(t.deadline), 'd MMM yyyy', { locale: fr })
                    : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
