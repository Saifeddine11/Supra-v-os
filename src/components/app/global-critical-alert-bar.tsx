'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CriticalActiveAlertDTO, CriticalActiveAlertsResponse } from '@/lib/notifications/critical-active-types';
import {
  CRITICAL_BAR_MINIMIZED_KEY,
  CRITICAL_BAR_SNOOZE_KEY,
  CRITICAL_BAR_SUPPRESS_FP_KEY,
} from '@/lib/notifications/critical-bar-constants';
import { summarizeCriticalAlerts, triggerCriticalAlertFeedbackFromActiveApi } from '@/lib/notifications/critical-alert-feedback';
import { SUPRA_AUDIO_UNLOCK_EVENT } from '@/lib/notifications/critical-sound-events';
import { cn } from '@/lib/utils/cn';

const POLL_MS = 5 * 60 * 1000;

async function fetchCriticalActive(): Promise<CriticalActiveAlertsResponse | null> {
  try {
    const r = await fetch('/api/notifications/critical-active', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const ct = r.headers.get('content-type') ?? '';
    if (!r.ok || !ct.includes('application/json')) return null;
    const json = (await r.json()) as CriticalActiveAlertsResponse;
    if (!Array.isArray(json.alerts) || typeof json.criticalCount !== 'number' || typeof json.warningCount !== 'number') {
      return null;
    }
    return json;
  } catch {
    return null;
  }
}

function snoozeUntil(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(CRITICAL_BAR_SNOOZE_KEY);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function isSnoozed(): boolean {
  return Date.now() < snoozeUntil();
}

function snoozeBarTwoHours() {
  localStorage.setItem(CRITICAL_BAR_SNOOZE_KEY, String(Date.now() + 2 * 60 * 60 * 1000));
}

/** Empreinte stable des alertes critiques (réapparition si le jeu change). */
function criticalFingerprint(p: CriticalActiveAlertsResponse): string {
  return p.alerts
    .filter((a) => a.severity === 'critical')
    .map((a) => a.id)
    .sort()
    .join('|');
}

function readSuppressFp(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CRITICAL_BAR_SUPPRESS_FP_KEY);
}

function writeSuppressFp(fp: string) {
  localStorage.setItem(CRITICAL_BAR_SUPPRESS_FP_KEY, fp);
}

function clearSuppressFp() {
  localStorage.removeItem(CRITICAL_BAR_SUPPRESS_FP_KEY);
}

function readMinimized(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CRITICAL_BAR_MINIMIZED_KEY) === '1';
}

function writeMinimized(v: boolean) {
  if (v) localStorage.setItem(CRITICAL_BAR_MINIMIZED_KEY, '1');
  else localStorage.removeItem(CRITICAL_BAR_MINIMIZED_KEY);
}

const btnSm =
  'h-8 min-h-0 shrink-0 rounded-[10px] px-2.5 text-xs font-medium sm:h-9 sm:px-3';

export function GlobalCriticalAlertBar() {
  const pathname = usePathname();
  const [payload, setPayload] = useState<CriticalActiveAlertsResponse | null>(null);
  const [snoozeTick, setSnoozeTick] = useState(0);
  const [uiTick, setUiTick] = useState(0);
  /** Liste détaillée sous la ligne compacte. */
  const [detailOpen, setDetailOpen] = useState(false);
  const [stripMinimized, setStripMinimized] = useState(false);
  const payloadRef = useRef<CriticalActiveAlertsResponse | null>(null);
  /** Une seule lecture son + toast à l’ouverture de la session composant (pas à chaque route). */
  const hasPlayedInitialFeedbackRef = useRef(false);

  /** Son + toast : ouverture app / polling — pas à chaque changement de route. */
  const maybePlayFeedback = useCallback((p: CriticalActiveAlertsResponse | null, mode: 'navigation' | 'ambient') => {
    if (!p || p.criticalCount === 0 || isSnoozed()) return;
    triggerCriticalAlertFeedbackFromActiveApi(p, mode);
  }, []);

  /* Données à chaque navigation / snooze ; son + toast seulement la première fois si critiques. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await fetchCriticalActive();
      if (cancelled) return;
      setPayload(p);
      payloadRef.current = p;
      if (!p || isSnoozed()) return;
      if (p.criticalCount > 0 && !hasPlayedInitialFeedbackRef.current) {
        hasPlayedInitialFeedbackRef.current = true;
        maybePlayFeedback(p, 'navigation');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, snoozeTick, maybePlayFeedback]);

  useEffect(() => {
    setStripMinimized(readMinimized());
  }, [uiTick]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void (async () => {
        const p = await fetchCriticalActive();
        setPayload(p);
        payloadRef.current = p;
        if (!p || p.criticalCount === 0 || isSnoozed()) return;
        maybePlayFeedback(p, 'ambient');
      })();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [maybePlayFeedback]);

  useEffect(() => {
    const onUnlock = () => {
      const p = payloadRef.current;
      if (!p || p.criticalCount === 0 || isSnoozed()) return;
      triggerCriticalAlertFeedbackFromActiveApi(p, 'navigation', { bypassBundleThrottle: true });
    };
    window.addEventListener(SUPRA_AUDIO_UNLOCK_EVENT, onUnlock);
    return () => window.removeEventListener(SUPRA_AUDIO_UNLOCK_EVENT, onUnlock);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        const p = await fetchCriticalActive();
        setPayload(p);
        payloadRef.current = p;
      })();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, []);

  if (!payload || payload.alerts.length === 0) return null;
  if (isSnoozed()) return null;

  const { alerts, criticalCount, warningCount } = payload;
  const fp = criticalCount > 0 ? criticalFingerprint(payload) : '';
  const suppressed = typeof window !== 'undefined' && fp.length > 0 && readSuppressFp() === fp;

  const shortTitle =
    criticalCount > 0
      ? criticalCount > 1
        ? `${criticalCount} alertes critiques`
        : '1 alerte critique'
      : warningCount > 1
        ? `${warningCount} alertes`
        : '1 alerte';

  const shortSubtitle =
    criticalCount > 0 ? summarizeCriticalAlerts(alerts) : 'À surveiller — ouvrez le détail pour la liste.';

  const barSurface = cn(
    'border-b border-[rgba(255,61,10,0.18)] bg-[#FFF4F0]/[0.97] text-foreground',
    'dark:border-[rgba(255,61,10,0.22)] dark:bg-[color-mix(in_srgb,hsl(var(--card))_96%,#2a1510_4%)]',
  );

  const iconWrap = cn(
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(255,61,10,0.22)]',
    'bg-[rgba(255,61,10,0.08)] text-[#FF3D0A] dark:border-[rgba(255,106,42,0.28)] dark:bg-[rgba(255,61,10,0.1)] dark:text-[#FF6A2A]',
  );

  if (suppressed) {
    return (
      <div className={cn(barSurface, 'shadow-none')} role="status">
        <div className="mx-auto flex h-10 max-w-[1600px] items-center justify-between gap-2 px-3 sm:h-11 sm:px-6 lg:px-8">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{shortTitle}</span>
            {' · '}
            masquée — réapparaît si le jeu d’alertes change
          </p>
          <Button
            type="button"
            variant="outline"
            className={cn(btnSm, 'border-[rgba(255,61,10,0.25)] bg-background/90')}
            onClick={() => {
              clearSuppressFp();
              setUiTick((n) => n + 1);
            }}
          >
            Afficher
          </Button>
        </div>
      </div>
    );
  }

  if (stripMinimized) {
    return (
      <div className={cn(barSurface)} role="status">
        <div className="mx-auto flex h-10 max-w-[1600px] items-center justify-between gap-2 px-3 sm:h-11 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <span className={iconWrap} aria-hidden>
              <AlertTriangle className="h-4 w-4" strokeWidth={2} />
            </span>
            <p className="truncate text-xs font-medium tabular-nums text-foreground sm:text-sm">{shortTitle}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className={cn(btnSm, 'border-[rgba(255,61,10,0.25)] bg-background/90')}
            onClick={() => {
              writeMinimized(false);
              setStripMinimized(false);
              setUiTick((n) => n + 1);
            }}
          >
            Afficher
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(barSurface, 'relative z-0 shadow-none')} role="alert" aria-live="polite">
      <div className="mx-auto max-w-[1600px] px-3 py-2 sm:px-6 sm:py-2.5 lg:px-8">
        <div className="flex min-h-[48px] flex-col gap-2 sm:min-h-[52px] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <span className={iconWrap} aria-hidden>
              <AlertTriangle className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 py-0.5">
              <p className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground">{shortTitle}</p>
              <p className="line-clamp-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">{shortSubtitle}</p>
            </div>
          </div>

          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-1 sm:justify-end sm:gap-1.5">
            <Button variant="outline" size="sm" className={cn(btnSm, 'border-[rgba(255,61,10,0.2)] bg-background/90')} asChild>
              <Link href="/tasks">Tâches</Link>
            </Button>
            <Button variant="outline" size="sm" className={cn(btnSm, 'border-[rgba(255,61,10,0.2)] bg-background/90')} asChild>
              <Link href="/videos">Vidéos</Link>
            </Button>
            <Button variant="outline" size="sm" className={cn(btnSm, 'border-[rgba(255,61,10,0.2)] bg-background/90')} asChild>
              <Link href="/dashboard">Tableau de bord</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(btnSm, 'border-[rgba(255,61,10,0.2)] bg-background/90')}
              aria-expanded={detailOpen}
              onClick={() => setDetailOpen((v) => !v)}
            >
              {detailOpen ? (
                <>
                  <ChevronUp className="mr-0.5 h-3.5 w-3.5 opacity-70" aria-hidden />
                  Masquer
                </>
              ) : (
                <>
                  <ChevronDown className="mr-0.5 h-3.5 w-3.5 opacity-70" aria-hidden />
                  Détail
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(btnSm, 'border-[rgba(255,61,10,0.2)] bg-background/90')}
              title="Réduire la barre"
              onClick={() => {
                setDetailOpen(false);
                writeMinimized(true);
                setStripMinimized(true);
                setUiTick((n) => n + 1);
              }}
            >
              <Minus className="mr-0.5 h-3.5 w-3.5 opacity-70" aria-hidden />
              Réduire
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
              title="Masquer jusqu’à changement d’alertes ou Afficher"
              onClick={() => {
                if (criticalCount > 0 && fp.length > 0) writeSuppressFp(fp);
                setDetailOpen(false);
                setUiTick((n) => n + 1);
              }}
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
              title="Masquer 2 h (snooze)"
              onClick={() => {
                snoozeBarTwoHours();
                setSnoozeTick((n) => n + 1);
              }}
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={2} />
            </Button>
          </div>
        </div>

        {detailOpen ? (
          <div className="mt-2 max-h-[220px] overflow-y-auto rounded-xl border border-[rgba(255,61,10,0.12)] bg-background/50 py-2 pl-2 pr-1 dark:bg-black/20">
            <ul className="space-y-2 pr-1">
              {alerts.map((a: CriticalActiveAlertDTO) => (
                <li key={a.id}>
                  <div className="flex flex-col gap-1 rounded-lg px-2 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-[10px] font-semibold uppercase tracking-wide',
                          a.severity === 'critical' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400',
                        )}
                      >
                        {a.title}
                      </p>
                      <p className="text-xs leading-snug text-foreground">{a.message}</p>
                    </div>
                    <Link
                      href={a.href}
                      className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Voir
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
