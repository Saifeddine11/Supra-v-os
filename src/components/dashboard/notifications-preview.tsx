import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowRight, Bell } from 'lucide-react';
import { SectionCard } from '@/components/shared/section-card';
import type { Notification } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { NOTIFICATION_PRIORITY_LABELS, NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/labels';

export function NotificationsPreview({ items }: { items: Notification[] }) {
  return (
    <SectionCard
      title="Notifications"
      description="Dernières alertes — synchronisées avec Supabase."
      action={
        <Link href="/notifications" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          Tout voir
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <Bell className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Aucune notification récente.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={cn(
                'rounded-xl border px-3 py-2.5 transition-colors',
                !n.is_read
                  ? 'border-primary/25 bg-primary/[0.05]'
                  : 'border-border/60 bg-muted/50'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={cn('text-sm leading-snug', !n.is_read ? 'text-foreground' : 'text-muted-foreground')}>
                  {n.title}
                </p>
                <Badge
                  variant={n.priority === 'urgent' ? 'destructive' : n.priority === 'high' ? 'warning' : 'outline'}
                  className="shrink-0 text-[10px]"
                >
                  {NOTIFICATION_PRIORITY_LABELS[n.priority]}
                </Badge>
              </div>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-primary/85">
                {NOTIFICATION_TYPE_LABELS[n.type]}
              </p>
              {n.message ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
              ) : null}
              <p className="mt-1.5 text-[10px] text-muted-foreground/80">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
