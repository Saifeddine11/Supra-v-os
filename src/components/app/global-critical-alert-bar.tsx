'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CriticalActiveAlertDTO, CriticalActiveAlertsResponse } from '@/lib/notifications/critical-active-types';
import { CRITICAL_BAR_SNOOZE_KEY } from '@/lib/notifications/critical-bar-constants';
import { triggerCriticalAlertFeedbackFromActiveApi } from '@/lib/notifications/critical-alert-feedback';
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
    if (!r.ok || !ct.includes('application/json')) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[critical-banner] fetch failed', r.status, 'redirected=', r.redirected, 'ct=', ct.slice(0, 48));
      }
      return null;
    }
    const json = (await r.json()) as CriticalActiveAlertsResponse;
    if (!Array.isArray(json.alerts) || typeof json.criticalCount !== 'number' || typeof json.warningCount !== 'number') {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[critical-banner] invalid JSON shape', json);
      }
      return null;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('[critical-banner] alerts received', json.alerts.length, 'critical', json.criticalCount);
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

export function GlobalCriticalAlertBar() {
  const pathname = usePathname();
  const [payload, setPayload] = useState<CriticalActiveAlertsResponse | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [snoozeTick, setSnoozeTick] = useState(0);
  const hiddenAtRef = useRef<number | null>(null);
  const payloadRef = useRef<CriticalActiveAlertsResponse | null>(null);

  const applyPayload = useCallback((p: CriticalActiveAlertsResponse | null, playReason: 'navigation' | 'ambient') => {
    setPayload(p);
    payloadRef.current = p;
    const snoozed = isSnoozed();
    const critical = p?.criticalCount ?? 0;
    const alertsLen = p?.alerts?.length ?? 0;

    if (process.env.NODE_ENV === 'development') {
      let lastPlayedAt = 0;
      let audioUnlocked = false;
      if (typeof window !== 'undefined') {
        lastPlayedAt = Number(localStorage.getItem('supra_mandatory_critical_sound_ms')) || 0;
        try {
          audioUnlocked = sessionStorage.getItem('supra_audio_gesture') === '1';
        } catch {
          audioUnlocked = false;
        }
      }
      const shouldPlay = Boolean(p && !snoozed && critical > 0);
      console.log('[critical-sound] alerts', alertsLen);
      console.log('[critical-sound] shouldPlay', shouldPlay);
      console.log('[critical-sound] audioUnlocked', audioUnlocked);
      console.log('[critical-sound] lastPlayedAt', lastPlayedAt);
    }

    if (!p || snoozed) return;
    if (critical > 0) {
      triggerCriticalAlertFeedbackFromActiveApi(p, playReason === 'ambient' ? 'ambient' : 'navigation');
    }
  }, []);

  const load = useCallback(
    async (playReason: 'navigation' | 'ambient') => {
      const p = await fetchCriticalActive();
      applyPayload(p, playReason);
    },
    [applyPayload],
  );

  useEffect(() => {
    void load('navigation');
  }, [load, pathname, snoozeTick]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load('ambient');
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

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
      if (document.visibilityState !== 'visible') {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      void (async () => {
        const p = await fetchCriticalActive();
        setPayload(p);
        payloadRef.current = p;
        if (!p || p.criticalCount === 0 || isSnoozed()) return;
        const away = hiddenAt != null && Date.now() - hiddenAt > 2000;
        if (away) triggerCriticalAlertFeedbackFromActiveApi(p, 'navigation');
      })();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, []);

  if (!payload || payload.alerts.length === 0) {
    if (process.env.NODE_ENV === 'development' && payload) {
      console.log('[critical-banner] hidden: empty alerts array');
    }
    return null;
  }
  if (isSnoozed()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[critical-banner] hidden: snoozed 2h');
    }
    return null;
  }

  const { alerts, criticalCount, warningCount } = payload;
  const headline =
    criticalCount > 0
      ? criticalCount > 1
        ? `${criticalCount} alertes critiques à traiter`
        : '1 alerte critique à traiter'
      : warningCount > 1
        ? `${warningCount} alertes à surveiller`
        : '1 alerte à surveiller';

  const preview = alerts.slice(0, 4);

  return (
    <div
      className={cn(
        'border-b border-destructive/40 bg-gradient-to-r from-destructive/25 via-[hsl(24_95%_42%/0.22)] to-destructive/20',
        'text-foreground shadow-[0_8px_32px_-12px_rgba(220,38,38,0.45)]',
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/50 bg-destructive/15">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-foreground">{headline}</p>
              <p className="text-xs text-muted-foreground">
                Basé sur l’état réel des tâches et vidéos — marquer une notification comme lue ne résout pas l’alerte.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 border-destructive/30 bg-background/80" asChild>
              <Link href="/tasks">Tâches</Link>
            </Button>
            <Button variant="outline" size="sm" className="h-8 border-destructive/30 bg-background/80" asChild>
              <Link href="/videos">Vidéos</Link>
            </Button>
            <Button variant="outline" size="sm" className="h-8 border-destructive/30 bg-background/80" asChild>
              <Link href="/dashboard">Tableau de bord</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  <ChevronUp className="mr-1 h-3.5 w-3.5" /> Réduire
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3.5 w-3.5" /> Détail
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              title="Masquer 2 h — la bannière reviendra si le problème persiste"
              onClick={() => {
                snoozeBarTwoHours();
                setSnoozeTick((n) => n + 1);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {expanded ? (
          <ul className="space-y-1 border-t border-destructive/20 pt-2 text-sm">
            {preview.map((a: CriticalActiveAlertDTO) => (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md py-1 hover:bg-background/30"
                >
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide',
                      a.severity === 'critical' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {a.title}
                  </span>
                  <span className="text-xs text-foreground/90">{a.message}</span>
                  <span className="text-[11px] font-medium text-primary">Voir →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
