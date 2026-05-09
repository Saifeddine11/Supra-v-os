import { SectionCard } from '@/components/shared/section-card';
import { WorkloadIndicator } from '@/components/shared/workload-indicator';
import type { WorkloadMember } from '@/data/dashboard-mock';

export function TeamLoadSection({ members }: { members: WorkloadMember[] }) {
  return (
    <SectionCard title="Charge équipe" description="Pourcentages indicatifs de capacité utilisée.">
      <div className="grid gap-5 sm:grid-cols-2">
        {members.map((m) => (
          <WorkloadIndicator key={m.name} member={m} />
        ))}
      </div>
    </SectionCard>
  );
}
