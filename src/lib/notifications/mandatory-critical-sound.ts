'use client';

import { playMandatoryCriticalAlarm } from '@/lib/notifications/notification-sound';

const STORAGE_LAST_SOUND_MS = 'supra_mandatory_critical_sound_ms';

const GAP_NAVIGATION_MS = 10_000;
const GAP_AMBIENT_MS = 2 * 60 * 60 * 1000;

export type TryMandatoryCriticalOptions = {
  /** Après premier geste utilisateur : rejouer même si moins de 10 s (déblocage autoplay). */
  bypassNavigationThrottle?: boolean;
};

/**
 * Anti-spam local : navigation / focus / mount → 10 s min entre déclenchements (clé LS).
 * Polling périodique (ambient) → 2 h min pour rappel sonore sans spam.
 * Les prefs utilisateur sont ignorées (alertes critiques obligatoires).
 */
export function tryPlayMandatoryCriticalSound(
  hasCritical: boolean,
  reason: 'navigation' | 'ambient',
  opts?: TryMandatoryCriticalOptions,
): void {
  if (!hasCritical || typeof window === 'undefined') return;
  const now = Date.now();
  const last = Number(localStorage.getItem(STORAGE_LAST_SOUND_MS)) || 0;
  const gap = reason === 'ambient' ? GAP_AMBIENT_MS : GAP_NAVIGATION_MS;
  if (!opts?.bypassNavigationThrottle && now - last < gap) return;
  if (opts?.bypassNavigationThrottle) {
    playMandatoryCriticalAlarm({ skipMinGapForTest: true });
    return;
  }
  playMandatoryCriticalAlarm();
}
