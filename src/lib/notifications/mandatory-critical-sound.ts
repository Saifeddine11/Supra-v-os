'use client';

import { playMandatoryCriticalAlarm } from '@/lib/notifications/notification-sound';

const STORAGE_LAST_SOUND_MS = 'supra_mandatory_critical_sound_ms';

const GAP_NAVIGATION_MS = 10_000;
const GAP_AMBIENT_MS = 2 * 60 * 60 * 1000;

/**
 * Anti-spam local : navigation / focus / mount → 10 s min entre déclenchements (clé LS).
 * Polling périodique (ambient) → 2 h min pour rappel sonore sans spam.
 * Les prefs utilisateur sont ignorées (alertes critiques obligatoires).
 */
export function tryPlayMandatoryCriticalSound(hasCritical: boolean, reason: 'navigation' | 'ambient'): void {
  if (!hasCritical || typeof window === 'undefined') return;
  const now = Date.now();
  const last = Number(localStorage.getItem(STORAGE_LAST_SOUND_MS)) || 0;
  const gap = reason === 'ambient' ? GAP_AMBIENT_MS : GAP_NAVIGATION_MS;
  if (now - last < gap) return;
  playMandatoryCriticalAlarm();
}
