'use client';

import type { NotificationSoundLevel } from '@/lib/notifications/notification-sound-level';
import type { NotificationSoundPrefs } from '@/lib/notifications/notification-sound-prefs';
import { canPlayNotificationSound } from '@/lib/notifications/notification-sound-prefs';

const THROTTLE_MS = 12_000;
const CRITICAL_DEBOUNCE_MS = 900;

let audioContext: AudioContext | null = null;
let userGestureUnlocked = false;
let lastPlayAt = 0;
let lastPlayedLevel: NotificationSoundLevel | null = null;
/** Anti-chevauchement alarme critique obligatoire (cloche + bannière). */
let lastMandatoryCriticalAt = 0;
const MANDATORY_CRITICAL_MIN_GAP_MS = 4000;

export function markNotificationSoundUserGesture(): void {
  userGestureUnlocked = true;
  try {
    const Ctx = typeof window !== 'undefined' ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : null;
    if (!Ctx) return;
    if (!audioContext) audioContext = new Ctx();
    if (audioContext.state === 'suspended') void audioContext.resume();
  } catch {
    /* ignore */
  }
}

function gainForVolume(v: NotificationSoundPrefs['notification_sound_volume']): number {
  switch (v) {
    case 'low':
      return 0.12;
    case 'high':
      return 0.38;
    default:
      return 0.22;
  }
}

function baseGain(level: NotificationSoundLevel, prefs: NotificationSoundPrefs | null): number {
  const v = prefs?.notification_sound_volume ?? 'medium';
  const m = gainForVolume(v);
  switch (level) {
    case 'silent':
      return 0;
    case 'soft':
      return m * 0.45;
    case 'important':
      return m * 0.85;
    case 'urgent':
      return m * 1.15;
    case 'critical':
      return m * 1.35;
    default:
      return m;
  }
}

/**
 * Anti-spam : au plus un son toutes les ~12 s. Les critiques passent en priorité
 * (hors fenêtre anti-double-critique très courte).
 */
export function throttleNotificationSound(now: number, level: NotificationSoundLevel): boolean {
  if (level === 'critical') {
    if (now - lastPlayAt < CRITICAL_DEBOUNCE_MS && lastPlayedLevel === 'critical') return false;
    lastPlayAt = now;
    lastPlayedLevel = 'critical';
    return true;
  }
  if (now - lastPlayAt < THROTTLE_MS) return false;
  lastPlayAt = now;
  lastPlayedLevel = level;
  return true;
}

function playOscillatorPattern(level: NotificationSoundLevel, masterGain: number): void {
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!audioContext) audioContext = new Ctx();
  const ac = audioContext;
  if (ac.state === 'suspended') void ac.resume();

  const now = ac.currentTime;
  const g = ac.createGain();
  g.gain.value = 0;
  g.connect(ac.destination);

  const tone = (freq: number, t0: number, dur: number, peak: number) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t0);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + dur);
    g.gain.linearRampToValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak * masterGain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  };

  switch (level) {
    case 'soft':
      tone(880, now, 0.055, 0.55);
      break;
    case 'important':
      tone(660, now, 0.07, 0.65);
      tone(880, now + 0.09, 0.08, 0.55);
      break;
    case 'urgent':
      tone(990, now, 0.08, 0.75);
      tone(1320, now + 0.11, 0.09, 0.7);
      break;
    case 'critical':
      tone(1320, now, 0.06, 0.85);
      tone(880, now + 0.08, 0.07, 0.8);
      tone(440, now + 0.17, 0.12, 0.9);
      break;
    default:
      break;
  }
}

async function tryPlayMp3ThenOsc(level: NotificationSoundLevel, masterGain: number): Promise<void> {
  const files: Record<Exclude<NotificationSoundLevel, 'silent'>, string> = {
    soft: '/sounds/notification-soft.mp3',
    important: '/sounds/notification-important.mp3',
    urgent: '/sounds/notification-urgent.mp3',
    critical: '/sounds/notification-critical.mp3',
  };
  if (level === 'silent') return;
  const url = files[level];
  try {
    const audio = new Audio(url);
    audio.volume = Math.min(1, masterGain * 2.2);
    await audio.play();
  } catch {
    playOscillatorPattern(level, masterGain);
  }
}

function playRaw(level: NotificationSoundLevel, prefs: NotificationSoundPrefs | null): void {
  if (level === 'silent') return;
  const g = baseGain(level, prefs);
  void tryPlayMp3ThenOsc(level, g);
}

/**
 * Aperçu depuis les paramètres : pas d’anti-spam, ignore « activer les sons »
 * (le clic utilisateur est une intention explicite).
 */
export function playNotificationSoundPreview(level: NotificationSoundLevel, prefs: NotificationSoundPrefs): void {
  markNotificationSoundUserGesture();
  if (level === 'silent') return;
  playRaw(level, prefs);
}

/**
 * Joue un son court (fichier public si présent, sinon synthèse Web Audio).
 */
export function playNotificationSound(level: NotificationSoundLevel, prefs: NotificationSoundPrefs | null): void {
  if (!userGestureUnlocked || level === 'silent') return;
  if (!canPlayNotificationSound(level, prefs)) return;
  const now = Date.now();
  if (!throttleNotificationSound(now, level)) return;
  playRaw(level, prefs);
}

/** Synthèse ~3,5 s — secours si MP3 critique indisponible ou autoplay bloqué. */
function playOscillatorCriticalMandatory(): void {
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!audioContext) audioContext = new Ctx();
  const ac = audioContext;
  if (ac.state === 'suspended') void ac.resume();

  const t0 = ac.currentTime;
  const g = ac.createGain();
  g.gain.value = 0;
  g.connect(ac.destination);

  const tone = (freq: number, start: number, dur: number, peak: number) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, start);
    o.connect(g);
    o.start(start);
    o.stop(start + dur);
    g.gain.linearRampToValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak * 0.95, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  };

  let t = t0;
  for (let i = 0; i < 6; i++) {
    tone(i % 2 === 0 ? 1320 : 880, t, 0.28, 0.92);
    t += 0.42;
    tone(660, t, 0.22, 0.75);
    t += 0.38;
  }
}

/**
 * Son critique obligatoire : ignore les préférences « désactiver les sons » / urgent only.
 * Tente de débloquer AudioContext ; volume fichier à 1.0.
 */
const MANDATORY_LS_KEY = 'supra_mandatory_critical_sound_ms';

/** Retourne false si rejeté par anti-chevauchement (quelques secondes). */
export function playMandatoryCriticalAlarm(): boolean {
  const now = Date.now();
  if (now - lastMandatoryCriticalAt < MANDATORY_CRITICAL_MIN_GAP_MS) return false;
  lastMandatoryCriticalAt = now;
  if (typeof window !== 'undefined') {
    localStorage.setItem(MANDATORY_LS_KEY, String(now));
  }
  markNotificationSoundUserGesture();
  if (typeof window === 'undefined') return true;
  void (async () => {
    try {
      const audio = new Audio('/sounds/notification-critical.mp3');
      audio.volume = 1.0;
      await audio.play();
    } catch {
      playOscillatorCriticalMandatory();
    }
  })();
  return true;
}
