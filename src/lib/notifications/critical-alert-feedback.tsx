'use client';

import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Notification } from '@/types/database';
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/labels';
import { playMandatoryCriticalAlarm } from '@/lib/notifications/notification-sound';
import { getNotificationSoundLevel, soundLevelRank } from '@/lib/notifications/notification-sound-level';
import type { CriticalActiveAlertDTO, CriticalActiveAlertsResponse, CriticalActiveAlertTotals } from '@/lib/notifications/critical-active-types';
import { CRITICAL_ALERT_TOAST_SEEN_KEY, CRITICAL_BAR_SNOOZE_KEY } from '@/lib/notifications/critical-bar-constants';
import { cn } from '@/lib/utils/cn';

const BUNDLE_LS_KEY = 'supra_critical_feedback_bundle_ms';
const TOAST_ID = 'supra-critical-feedback';

const GAP_NAV_MS = 10_000;
const GAP_AMBIENT_MS = 2 * 60 * 60 * 1000;

/** Mémoire stricte "1 son par ouverture + 1 son par nouvelle alerte". */
const CRITICAL_SOUND_PLAYED_SESSION_KEY = 'supra_critical_sound_played_session_v1';
const CRITICAL_ALERT_FINGERPRINTS_SESSION_KEY = 'supra_critical_alert_fingerprints_v1';

type CriticalFingerprintsState = {
  loaded: boolean;
  played: boolean;
  seen: Set<string>;
};

let fpState: CriticalFingerprintsState = {
  loaded: false,
  played: false,
  seen: new Set<string>(),
};

function safeSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function mergeLocalSeenFingerprints(seen: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(CRITICAL_ALERT_TOAST_SEEN_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    for (const x of arr) {
      if (typeof x === 'string') seen.add(x);
    }
  } catch {
    // ignore
  }
}

function persistLocalSeenFingerprints(seen: Set<string>): void {
  if (typeof window === 'undefined') return;
  const arr = [...seen].slice(-200);
  localStorage.setItem(CRITICAL_ALERT_TOAST_SEEN_KEY, JSON.stringify(arr));
}

function loadFingerprintsState(): CriticalFingerprintsState {
  if (fpState.loaded) return fpState;
  fpState.loaded = true;

  const ss = safeSessionStorage();
  if (ss) {
    fpState.played = ss.getItem(CRITICAL_SOUND_PLAYED_SESSION_KEY) === '1';
    const raw = ss.getItem(CRITICAL_ALERT_FINGERPRINTS_SESSION_KEY);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) fpState.seen = new Set(arr.filter((x) => typeof x === 'string'));
      } catch {
        // ignore
      }
    }
  }

  mergeLocalSeenFingerprints(fpState.seen);
  if (fpState.seen.size > 0) fpState.played = true;

  return fpState;
}

function persistFingerprintsState(state: CriticalFingerprintsState): void {
  const ss = safeSessionStorage();
  if (ss) {
    ss.setItem(CRITICAL_SOUND_PLAYED_SESSION_KEY, state.played ? '1' : '0');
    ss.setItem(CRITICAL_ALERT_FINGERPRINTS_SESSION_KEY, JSON.stringify([...state.seen]));
  }
  persistLocalSeenFingerprints(state.seen);
}

/** Marque les alertes visibles dans la bannière comme déjà signalées (pas de toast doublon). */
export function acknowledgeCriticalAlertsShownInBanner(p: CriticalActiveAlertsResponse): void {
  if (typeof window === 'undefined') return;

  const state = loadFingerprintsState();
  const fps = criticalActiveFingerprints(p);
  for (const fp of fps) state.seen.add(fp);
  state.played = true;
  persistFingerprintsState(state);
}

function criticalActiveFingerprints(p: CriticalActiveAlertsResponse): string[] {
  const source = p.allAlerts?.length ? p.allAlerts : p.alerts;
  return source
    .filter((a) => a.severity === 'critical')
    .map((a) => `ca:${a.id}`)
    .sort();
}

function bellFreshFingerprints(fresh: Notification[]): string[] {
  const unreadCritical = fresh.filter((n) => !n.is_read && getNotificationSoundLevel(n) === 'critical');
  return unreadCritical
    .map((n) => {
      const reType = (n as any).related_entity_type as string | null | undefined;
      const reId = (n as any).related_entity_id as string | null | undefined;
      return `notif:${n.type}:${reType ?? ''}:${reId ?? n.id}`;
    })
    .sort();
}

function isBarSnoozed(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(CRITICAL_BAR_SNOOZE_KEY);
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && Date.now() < n;
}

function bundleLastAt(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(BUNDLE_LS_KEY)) || 0;
}

function markBundleEmitted(): void {
  localStorage.setItem(BUNDLE_LS_KEY, String(Date.now()));
}

function isBundleThrottled(mode: 'navigation' | 'ambient'): boolean {
  const gap = mode === 'ambient' ? GAP_AMBIENT_MS : GAP_NAV_MS;
  return Date.now() - bundleLastAt() < gap;
}

function hrefForEntity(entityType: string): string {
  switch (entityType) {
    case 'task':
      return '/tasks';
    case 'video':
      return '/videos';
    case 'invoices':
      return '/invoices';
    default:
      return '/dashboard';
  }
}

export function summarizeCriticalAlertTotals(totals: CriticalActiveAlertTotals): string {
  const parts: string[] = [];
  if (totals.taskOverdueTotalCount) {
    parts.push(
      `${totals.taskOverdueTotalCount} tâche${totals.taskOverdueTotalCount > 1 ? 's' : ''} en retard`,
    );
  }
  if (totals.videoDeliveryTotalCount) {
    parts.push(
      `${totals.videoDeliveryTotalCount} livraison${totals.videoDeliveryTotalCount > 1 ? 's' : ''}`,
    );
  }
  if (totals.shootingActionTotalCount) {
    parts.push(
      `${totals.shootingActionTotalCount} tournage${totals.shootingActionTotalCount > 1 ? 's' : ''}`,
    );
  }
  if (totals.invoiceOverdueTotalCount) {
    parts.push(`${totals.invoiceOverdueTotalCount} facturation`);
  }
  return parts.join(' · ');
}

/** @deprecated Préférer summarizeCriticalAlertTotals avec les totaux serveur. */
export function summarizeCriticalAlerts(alerts: CriticalActiveAlertDTO[]): string {
  const tasks = alerts.filter((a) => a.entityType === 'task').length;
  const deliveries = alerts.filter((a) => a.id.startsWith('vid-od-')).length;
  const shootings = alerts.filter(
    (a) =>
      a.id.startsWith('vid-shoot-conf-') ||
      a.id.startsWith('vid-shoot-od-') ||
      a.id.startsWith('vid-shoot-end-od-'),
  ).length;
  const inv = alerts.filter((a) => a.entityType === 'invoices').length;
  const parts: string[] = [];
  if (tasks) parts.push(`${tasks} tâche${tasks > 1 ? 's' : ''} en retard`);
  if (deliveries) parts.push(`${deliveries} livraison${deliveries > 1 ? 's' : ''}`);
  if (shootings) parts.push(`${shootings} tournage${shootings > 1 ? 's' : ''}`);
  if (inv) parts.push(`${inv} facturation`);
  if (parts.length) return parts.join(' · ');
  return alerts
    .slice(0, 3)
    .map((a) => a.message)
    .join(' · ');
}

export function formatActionableBannerTitle(
  totals: CriticalActiveAlertTotals,
  scopeHint: CriticalActiveAlertsResponse['scopeHint'],
): string {
  const scopeWord = scopeHint === 'team' ? 'équipe' : 'opérationnelles';
  if (totals.totalActionableCount > 1) {
    return `${totals.totalActionableCount} actions ${scopeWord} à traiter`;
  }
  if (totals.totalActionableCount === 1) {
    return `1 action ${scopeWord} à traiter`;
  }
  return 'Points à suivre';
}

/** Ne déclenche pas le son pour des empreintes déjà absentes des alertes actives. */
export function filterNewCriticalFingerprints(
  fingerprints: string[],
  active: CriticalActiveAlertsResponse | null,
): string[] {
  if (!active) return fingerprints;
  const source = active.allAlerts?.length ? active.allAlerts : active.alerts;
  const live = new Set(source.filter((a) => a.severity === 'critical').map((a) => `ca:${a.id}`));
  return fingerprints.filter((fp) => live.has(fp));
}

function buildContentFromActiveApi(p: CriticalActiveAlertsResponse): {
  title: string;
  message: string;
  href: string;
  tone: 'critical';
} | null {
  const critical = p.alerts.filter((a) => a.severity === 'critical');
  if (critical.length === 0) return null;
  if (critical.length === 1) {
    const a = critical[0]!;
    return {
      title: a.title,
      message: a.message,
      href: a.href?.trim() || hrefForEntity(a.entityType),
      tone: 'critical',
    };
  }
  return {
    title: formatActionableBannerTitle(p.totals, p.scopeHint),
    message: summarizeCriticalAlertTotals(p.totals),
    href: '/dashboard',
    tone: 'critical',
  };
}

function showCriticalToast(content: {
  title: string;
  message: string;
  href: string;
  tone: 'critical' | 'urgent';
}): void {
  const isCritical = content.tone === 'critical';

  toast.custom(
    (tid) => (
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={cn(
          'pointer-events-auto w-full max-w-[min(480px,calc(100vw-24px))] overflow-hidden rounded-[18px] border text-left',
          'animate-in fade-in slide-in-from-right-4 duration-200 motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none',
          'shadow-[0_10px_36px_-14px_rgba(239,68,68,0.18)]',
          isCritical
            ? [
                'border-[#EF4444]/90 bg-[#FFF1EE]',
                'dark:border-[rgba(255,61,10,0.45)] dark:bg-[rgba(26,7,3,0.96)]',
                'dark:shadow-[0_16px_48px_-20px_rgba(255,61,10,0.35),0_8px_24px_-12px_rgba(0,0,0,0.5)]',
              ]
            : [
                'border-orange-500/55 bg-orange-50/95',
                'dark:border-orange-500/40 dark:bg-[rgba(26,7,3,0.96)]',
                'dark:shadow-[0_16px_40px_-16px_rgba(255,106,42,0.25)]',
              ],
        )}
      >
        <div className="relative px-3.5 py-3.5 sm:px-[18px] sm:py-[18px]">
          <button
            type="button"
            className={cn(
              'absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              'text-[#7A4A42]/80 hover:bg-black/[0.06] hover:text-[#160B08]',
              'dark:text-[#C9B8AE]/90 dark:hover:bg-white/[0.08] dark:hover:text-[#F8F4EF]',
            )}
            aria-label="Fermer la notification"
            onClick={() => toast.dismiss(tid)}
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>

          <div className="flex gap-3 pr-7">
            <span
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border',
                isCritical
                  ? 'border-[#FF3D0A]/45 bg-[#FF3D0A]/12 text-[#FF3D0A] dark:border-[rgba(255,61,10,0.4)] dark:bg-[rgba(255,61,10,0.12)] dark:text-[#FF6A2A]'
                  : 'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400',
              )}
              aria-hidden
            >
              <AlertTriangle className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1 space-y-1">
              <p
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-[0.12em]',
                  'text-[#7A4A42] dark:text-[#C9B8AE]',
                )}
              >
                À traiter
              </p>
              <p
                className={cn(
                  'text-[15px] font-semibold leading-snug tracking-tight',
                  'text-[#160B08] dark:text-[#F8F4EF]',
                )}
              >
                {content.title}
              </p>
              <p
                className={cn(
                  'text-[13px] leading-snug',
                  'text-[#7A4A42] dark:text-[#C9B8AE]',
                )}
              >
                {content.message}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-2.5">
                <Link
                  href={content.href}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold text-white transition-opacity hover:opacity-[0.92]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3D0A]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF1EE] dark:focus-visible:ring-offset-[#1A0703]',
                    isCritical ? 'bg-[#FF3D0A]' : 'bg-orange-600 hover:opacity-95',
                  )}
                  onClick={() => toast.dismiss(tid)}
                >
                  Voir
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      id: TOAST_ID,
      duration: 5200,
      dismissible: true,
      className:
        '!m-0 !w-full !max-w-[min(480px,calc(100vw-24px))] !bg-transparent !p-0 !shadow-none !border-0',
    },
  );
}

export type TriggerCriticalFeedbackOptions = {
  /** Après déblocage audio : rejouer le son même si fenêtre 10 s. */
  bypassBundleThrottle?: boolean;
  /** Ne pas lancer le son (rare ; défaut jouer). */
  skipSound?: boolean;
  /** Ne pas afficher le toast (ex. bannière déjà visible). */
  skipToast?: boolean;
};

/**
 * Toast + son critique synchronisés (anti-spam bundle commun).
 * Toast uniquement pour une alerte critique jamais vue — pas au chargement de page.
 */
export function triggerCriticalAlertFeedbackFromActiveApi(
  p: CriticalActiveAlertsResponse | null,
  mode: 'navigation' | 'ambient',
  opts?: TriggerCriticalFeedbackOptions,
): void {
  if (typeof window === 'undefined' || !p || p.criticalCount === 0) return;
  if (isBarSnoozed()) return;
  // La bannière compacte couvre l’état courant ; pas de toast à la navigation.
  if (mode === 'navigation') return;

  if (!opts?.bypassBundleThrottle && isBundleThrottled(mode)) return;

  const state = loadFingerprintsState();
  const fps = filterNewCriticalFingerprints(criticalActiveFingerprints(p), p);
  if (fps.length === 0) return;

  const newFps = fps.filter((fp) => !state.seen.has(fp));
  if (newFps.length === 0) return;

  state.played = true;
  for (const fp of fps) state.seen.add(fp);
  persistFingerprintsState(state);

  markBundleEmitted();

  const content =
    buildContentFromActiveApi(p) ?? {
      title: 'Actions à traiter',
      message: 'Des éléments requièrent encore votre attention.',
      href: '/dashboard',
      tone: 'critical' as const,
    };

  if (!opts?.skipToast) {
    showCriticalToast(content);
  }

  if (!opts?.skipSound) {
    try {
      playMandatoryCriticalAlarm(opts?.bypassBundleThrottle ? { skipMinGapForTest: true } : undefined);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[critical-feedback] playMandatoryCriticalAlarm', e);
      }
    }
  }
}

function normalizeBellHref(n: Notification): string {
  const u = n.link_url?.trim();
  if (!u) return '/notifications';
  if (u.startsWith('/')) return u;
  return '/notifications';
}

/**
 * Cloche polling : notifications fraîches au niveau sonore critique.
 */
export function triggerCriticalAlertFeedbackFromBellFresh(fresh: Notification[], opts?: TriggerCriticalFeedbackOptions): void {
  if (typeof window === 'undefined') return;
  const unreadCritical = fresh.filter((n) => !n.is_read && getNotificationSoundLevel(n) === 'critical');
  if (unreadCritical.length === 0) return;
  if (isBarSnoozed()) return;

  const state = loadFingerprintsState();
  const fps = bellFreshFingerprints(fresh);
  if (fps.length === 0) return;
  const newFps = fps.filter((fp) => !state.seen.has(fp));
  if (newFps.length === 0) return;

  state.played = true;
  for (const fp of fps) state.seen.add(fp);
  persistFingerprintsState(state);

  markBundleEmitted();

  const sorted = [...unreadCritical].sort(
    (a, b) => soundLevelRank(getNotificationSoundLevel(b)) - soundLevelRank(getNotificationSoundLevel(a)),
  );
  const primary = sorted[0]!;

  const typeLabel = NOTIFICATION_TYPE_LABELS[primary.type] ?? 'Alerte critique';
  const title =
    unreadCritical.length === 1 ? typeLabel : `${unreadCritical.length} alertes critiques (notifications)`;
  const message =
    unreadCritical.length === 1
      ? [primary.title, primary.message].filter(Boolean).join(' — ')
      : unreadCritical
          .slice(0, 4)
          .map((n) => n.title)
          .join(' · ');

  showCriticalToast({
    title,
    message: message || 'Ouvrez les notifications pour le détail.',
    href: normalizeBellHref(primary),
    tone: 'critical',
  });

  if (!opts?.skipSound) {
    try {
      playMandatoryCriticalAlarm(opts?.bypassBundleThrottle ? { skipMinGapForTest: true } : undefined);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[critical-feedback] bell playMandatoryCriticalAlarm', e);
      }
    }
  }
}
