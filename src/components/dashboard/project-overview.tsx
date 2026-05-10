import { SectionCard } from '@/components/shared/section-card';
import { ProgressBar } from '@/components/shared/progress-bar';
import type { ProjectRowMock } from '@/data/dashboard-mock';

export function ProjectOverview({ projects }: { projects: ProjectRowMock[] }) {
  return (
    <SectionCard title="Projets en cours" description="Projets client et internes — statuts actifs en base.">
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun projet en cours.</p>
      ) : (
        <ul className="space-y-4">
          {projects.map((p) => (
            <li key={p.id} className="rounded-xl border border-primary/20 bg-gradient-to-br from-card to-surface-secondary p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {p.type === 'internal' ? 'Interne' : 'Client'}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <ProgressBar value={p.progress} className="flex-1" trackClassName="bg-muted" />
                <span className="text-xs tabular-nums text-muted-foreground">{p.progress}%</span>
              </div>
              {p.blocker ? <p className="mt-2 text-xs text-[#FF6A2A]">Note : {p.blocker}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
