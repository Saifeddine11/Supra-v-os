import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ActivityLog } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { getStatusBlockSurface } from '@/lib/ui/status-block-tone';

export function RecentActivityPreview({ logs }: { logs: ActivityLog[] }) {
  if (!logs.length) return null;

  return (
    <div className="space-y-2">
      {logs.map((l) => (
        <div key={l.id} className={cn('p-2.5 text-sm', getStatusBlockSurface('muted'))}>
          <p className="line-clamp-2 text-foreground">
            <span className="font-medium">{l.actor_label ?? 'Système'}</span>
            <span className="text-muted-foreground"> · {l.action}</span>
            {l.entity_type ? <span className="text-muted-foreground"> · {l.entity_type}</span> : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {format(new Date(l.created_at), 'd MMM · HH:mm', { locale: fr })}
          </p>
        </div>
      ))}
      <Link href="/settings" className="inline-block text-xs font-semibold text-primary hover:underline">
        Paramètres & audit
      </Link>
    </div>
  );
}
