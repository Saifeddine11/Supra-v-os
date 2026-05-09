import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import type { VideoRowMock } from '@/data/dashboard-mock';
import { VIDEO_STATUS_COUNTS } from '@/data/dashboard-mock';

export function ProductionOverview({ videos }: { videos: VideoRowMock[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Vidéos par statut" description="Répartition indicative de la charge créative.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {VIDEO_STATUS_COUNTS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-primary/20 bg-gradient-to-br from-card to-surface-secondary px-3 py-3"
            >
              <p className="text-2xl font-semibold tabular-nums text-foreground">{s.count}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Production en cours" description="Extraits du pipeline — données fictives.">
        <ul className="space-y-3">
          {videos.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-1 rounded-lg border border-primary/20 bg-gradient-to-br from-card to-surface-secondary px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{v.title}</p>
                <p className="text-xs text-muted-foreground">{v.client}</p>
              </div>
              <StatusBadge
                status={
                  v.tone === 'success' ? 'success' : v.tone === 'warning' ? 'warning' : 'default'
                }
              >
                {v.status}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
