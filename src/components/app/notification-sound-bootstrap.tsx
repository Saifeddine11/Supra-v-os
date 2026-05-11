'use client';

import { useEffect } from 'react';
import { markNotificationSoundUserGesture } from '@/lib/notifications/notification-sound';

/**
 * Débloque l’audio après la première interaction (politique navigateur).
 */
export function NotificationSoundBootstrap() {
  useEffect(() => {
    const onFirst = () => {
      markNotificationSoundUserGesture();
    };
    window.addEventListener('pointerdown', onFirst, { once: true, passive: true });
    window.addEventListener('keydown', onFirst, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', onFirst);
      window.removeEventListener('keydown', onFirst);
    };
  }, []);
  return null;
}
