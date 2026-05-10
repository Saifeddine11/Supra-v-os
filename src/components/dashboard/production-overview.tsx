import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import type { VideoRowMock } from '@/data/dashboard-mock';
import { cn } from '@/lib/utils/cn';
import { getStatusBlockSurface, mockVideoRowToTone } from '@/lib/ui/status-block-tone';

export function ProductionOverview({
  videoStatusCounts,
  videos,
}: {
  videoStatusCounts: { label: string; count: number }[];
  videos: VideoRowMock[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Vidéos par statut" description="Répartition calculée à partir des vidéos en base.">
        {videoStatusCounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune vidéo en base pour le moment.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {videoStatusCounts.map((s) => (
              <div key={s.label} className={cn('px-3 py-3', getStatusBlockSurface('info'))}>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard title="Production en cours" description="Vidéos non publiées / non archivées — données live.">
        {videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune vidéo en production.</p>
        ) : (
          <ul className="space-y-3">
            {videos.map((v) => (
              <li
                key={v.id}
                className={cn(
                  'flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
                  getStatusBlockSurface(mockVideoRowToTone(v.tone)),
                )}
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
        )}
      </SectionCard>
    </div>
  );
}
