import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ActivityLog } from '@/types/database';

export function EntityActivityFeed({ logs }: { logs: ActivityLog[] }) {
  if (!logs.length) {
    return <p className="text-sm text-muted-foreground">Aucune activité enregistrée pour cet élément.</p>;
  }

  return (
    <ul className="space-y-3 text-sm">
      {logs.map((l) => (
        <li key={l.id} className="border-b border-border/50 pb-3 last:border-0">
          <p className="text-foreground">
            <span className="font-medium text-foreground">{l.actor_label ?? 'Système'}</span>
            <span className="text-muted-foreground"> · {l.action}</span>
            {l.entity_type ? <span className="text-muted-foreground"> · {l.entity_type}</span> : null}
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {format(new Date(l.created_at), 'd MMM yyyy · HH:mm', { locale: fr })}
          </p>
        </li>
      ))}
    </ul>
  );
}
