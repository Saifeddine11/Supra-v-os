import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ActivityLog } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { getStatusBlockSurface } from '@/lib/ui/status-block-tone';
import { formatActivityLogSummaryLine } from '@/lib/data/activity-log-display';
import type { DashboardVariant } from '@/lib/dashboard/dashboard-variant';

export function RecentActivityPreview({
  logs,
  variant,
}: {
  logs: ActivityLog[];
  variant: Extract<DashboardVariant, 'admin' | 'manager'>;
}) {
  if (!logs.length) return null;

  const ctaHref = variant === 'admin' ? '/team' : '/tasks';
  const ctaLabel = variant === 'admin' ? 'Gérer l’équipe' : 'Voir les tâches';

  return (
    <div className="space-y-2">
      {logs.map((l) => (
        <div key={l.id} className={cn('p-2.5 text-sm', getStatusBlockSurface('muted'))}>
          <p className="line-clamp-3 text-foreground">{formatActivityLogSummaryLine(l)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {format(new Date(l.created_at), 'd MMM · HH:mm', { locale: fr })}
          </p>
        </div>
      ))}
      <Link href={ctaHref} className="inline-block text-xs font-semibold text-primary hover:underline">
        {ctaLabel}
      </Link>
    </div>
  );
}
