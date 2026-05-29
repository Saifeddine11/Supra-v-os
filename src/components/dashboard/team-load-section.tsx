import { SectionCard } from '@/components/shared/section-card';
import { WorkloadIndicator } from '@/components/shared/workload-indicator';
import type { WorkloadMember } from '@/data/dashboard-mock';

export function TeamLoadSection({ members }: { members: WorkloadMember[] }) {
  return (
    <SectionCard
      title="Charge équipe"
      description="Estimation à partir des heures estimées sur tâches ouvertes vs capacité hebdomadaire déclarée."
    >
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune charge équipe disponible.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {members.map((m) => (
            <WorkloadIndicator key={m.id} member={m} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
