'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Notification, NotificationType } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NOTIFICATION_PRIORITY_LABELS, NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/labels';
import { markAllNotificationsReadAction, markNotificationReadAction } from './actions';
import { getStatusBlockSurface, notificationListTone } from '@/lib/ui/status-block-tone';

const FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'unread', label: 'Non lues' },
  { id: 'urgent', label: 'Urgentes' },
];

const TYPE_FILTERS: { id: NotificationType; label: string }[] = [
  'task_assigned',
  'task_overdue',
  'task_deadline_approaching',
  'invoice_overdue',
  'invoice_due_soon',
  'client_validated',
  'client_revision_requested',
  'quote_accepted',
  'morning_summary',
  'evening_summary',
].map((id) => ({ id: id as NotificationType, label: NOTIFICATION_TYPE_LABELS[id as NotificationType] }));

export function NotificationsClient({
  notifications,
  unreadTotal,
  activeFilter,
}: {
  notifications: Notification[];
  unreadTotal: number;
  activeFilter: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setTab(tab: string) {
    const p = new URLSearchParams(searchParams?.toString() ?? '');
    if (tab === 'all') p.delete('f');
    else p.set('f', tab);
    router.push(`/notifications${p.toString() ? `?${p}` : ''}`);
  }

  function toggleType(typeId: NotificationType) {
    const p = new URLSearchParams(searchParams?.toString() ?? '');
    if (searchParams?.get('type') === typeId) p.delete('type');
    else p.set('type', typeId);
    router.push(`/notifications${p.toString() ? `?${p}` : ''}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={activeFilter === f.id ? 'primary' : 'outline'}
              className="rounded-full"
              onClick={() => setTab(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={pending || unreadTotal === 0}
          onClick={() =>
            startTransition(async () => {
              await markAllNotificationsReadAction();
              router.refresh();
            })
          }
        >
          Tout marquer comme lu
        </Button>
      </div>

      <div className="rounded-xl border border-border/80 bg-card/60 p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Par type</p>
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleType(t.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                searchParams?.get('type') === t.id
                  ? 'border-primary/40 bg-primary/[0.1] text-primary'
                  : 'border-border/80 text-muted-foreground hover:border-primary/20'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-card/40 px-8 py-16 text-center">
          <p className="text-sm font-medium text-foreground">Aucune notification</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Les alertes métiers et rappels cron apparaîtront ici.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={cn(
                'p-4 transition-colors',
                getStatusBlockSurface(notificationListTone(n.priority, n.is_read), {
                  urgentGlow: !n.is_read && n.priority === 'urgent',
                }),
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={cn('text-sm font-semibold', !n.is_read ? 'text-foreground' : 'text-muted-foreground')}>
                      {n.title}
                    </h2>
                    <Badge variant={n.priority === 'urgent' ? 'destructive' : n.priority === 'high' ? 'warning' : 'outline'} className="text-[10px]">
                      {NOTIFICATION_PRIORITY_LABELS[n.priority]}
                    </Badge>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-primary/80">
                      {NOTIFICATION_TYPE_LABELS[n.type]}
                    </span>
                  </div>
                  {n.message ? <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.message}</p> : null}
                  <p className="text-xs text-muted-foreground/80">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {!n.is_read ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await markNotificationReadAction(n.id);
                          router.refresh();
                        })
                      }
                    >
                      Marquer lu
                    </Button>
                  ) : null}
                  {n.link_url ? (
                    <Button variant="outline" size="sm" className="h-8 rounded-full" asChild>
                      <Link href={n.link_url.startsWith('/') ? n.link_url : `/${n.link_url}`}>Ouvrir</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
