'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Notification } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NOTIFICATION_PRIORITY_LABELS, NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/labels';
import { markNotificationReadAction } from '@/app/(app)/notifications/actions';
import type { NotificationSoundPrefs } from '@/lib/notifications/notification-sound-prefs';
import { canPlayNotificationSound } from '@/lib/notifications/notification-sound-prefs';
import { playMandatoryCriticalAlarm, playNotificationSound } from '@/lib/notifications/notification-sound';
import type { NotificationSoundLevel } from '@/lib/notifications/notification-sound-level';
import { getNotificationSoundLevel, soundLevelRank } from '@/lib/notifications/notification-sound-level';

export function NotificationBell({
  initialUnread,
  initialPreview,
  soundPrefs,
}: {
  initialUnread: number;
  initialPreview: Notification[];
  soundPrefs: NotificationSoundPrefs;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [unread, setUnread] = useState(initialUnread);
  const [preview, setPreview] = useState(initialPreview);
  const sinceRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    setUnread(initialUnread);
    setPreview(initialPreview);
  }, [initialUnread, initialPreview]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const r = await fetch(
          `/api/notifications/bell-sync?since=${encodeURIComponent(sinceRef.current)}`,
          { cache: 'no-store' }
        );
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as {
          unread: number;
          preview: Notification[];
          fresh: Notification[];
        };
        setUnread(j.unread);
        setPreview(j.preview);

        const fresh = j.fresh ?? [];
        if (fresh.length === 0) return;

        let maxIso = sinceRef.current;
        let maxLevel: NotificationSoundLevel = 'silent';

        for (const n of fresh) {
          if (new Date(n.created_at) > new Date(maxIso)) maxIso = n.created_at;
          if (!n.is_read) {
            const lvl = getNotificationSoundLevel(n);
            if (soundLevelRank(lvl) > soundLevelRank(maxLevel)) maxLevel = lvl;
          }
        }
        sinceRef.current = maxIso;

        if (maxLevel === 'critical') {
          playMandatoryCriticalAlarm();
        } else if (maxLevel !== 'silent' && canPlayNotificationSound(maxLevel, soundPrefs)) {
          playNotificationSound(maxLevel, soundPrefs);
        }
      } catch {
        /* réseau / parse : ignorer */
      }
    }

    const interval = window.setInterval(tick, 35_000);
    const first = window.setTimeout(tick, 6_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(first);
    };
  }, [soundPrefs]);

  async function onOpenItem(n: Notification) {
    if (!n.is_read) {
      startTransition(async () => {
        await markNotificationReadAction(n.id);
        router.refresh();
      });
    }
    if (n.link_url) {
      router.push(n.link_url.startsWith('/') ? n.link_url : `/${n.link_url}`);
    }
  }

  const showBadge = unread > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground',
            showBadge && 'border-primary/25 text-primary'
          )}
          aria-label={`Notifications${showBadge ? ` — ${unread} non lues` : ''}`}
        >
          <Bell className="h-[18px] w-[18px]" />
          {showBadge ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2.5">
          <span className="text-foreground">Notifications</span>
          {showBadge ? (
            <Badge variant="primary" className="text-[10px]">
              {unread} non lues
            </Badge>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-[min(420px,70vh)] overflow-y-auto">
          {preview.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune notification récente.</p>
          ) : (
            preview.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="cursor-pointer flex-col items-stretch gap-1 rounded-none border-b border-border/70 px-3 py-3 last:border-0"
                disabled={pending}
                onSelect={(e) => {
                  e.preventDefault();
                  void onOpenItem(n);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn('text-sm font-medium leading-snug', !n.is_read ? 'text-foreground' : 'text-muted-foreground')}>
                    {n.title}
                  </span>
                  <Badge variant={n.priority === 'urgent' ? 'destructive' : n.priority === 'high' ? 'warning' : 'outline'} className="shrink-0 text-[10px]">
                    {NOTIFICATION_PRIORITY_LABELS[n.priority]}
                  </Badge>
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-primary/90">
                  {NOTIFICATION_TYPE_LABELS[n.type]}
                </span>
                {n.message ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                ) : null}
                <span className="text-[10px] text-muted-foreground/80">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="p-2">
          <Link
            href="/notifications"
            className="flex w-full items-center justify-center rounded-lg py-2 text-xs font-semibold text-primary hover:bg-primary/[0.08]"
          >
            Tout voir
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
