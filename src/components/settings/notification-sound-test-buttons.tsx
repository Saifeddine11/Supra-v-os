'use client';

import type { NotificationSoundPrefs } from '@/lib/notifications/notification-sound-prefs';
import { playNotificationSoundPreview } from '@/lib/notifications/notification-sound';
import { Button } from '@/components/ui/button';

export function NotificationSoundTestButtons({ prefs }: { prefs: NotificationSoundPrefs }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full border-border/80 text-xs"
        onClick={() => playNotificationSoundPreview('soft', prefs)}
      >
        Tester son discret
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full border-border/80 text-xs"
        onClick={() => playNotificationSoundPreview('urgent', prefs)}
      >
        Tester son urgent
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
        onClick={() => playNotificationSoundPreview('critical', prefs)}
      >
        Tester son critique
      </Button>
    </div>
  );
}
