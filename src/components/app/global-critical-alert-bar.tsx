'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CriticalActiveAlertDTO, CriticalActiveAlertsResponse } from '@/lib/notifications/critical-active-types';
import { CRITICAL_BAR_SNOOZE_KEY } from '@/lib/notifications/critical-bar-constants';
import {
  persistCriticalAlertBarUiState,
  readCriticalAlertBarState,
  resolveCriticalAlertBarUiState,
} from '@/lib/notifications/critical-bar-state';
import { CRITICAL_ALERTS_REFRESH_EVENT } from '@/lib/alerts/request-critical-alerts-refresh';
import { summarizeCriticalAlertTotals, formatActionableBannerTitle, acknowledgeCriticalAlertsShownInBanner, triggerCriticalAlertFeedbackFromActiveApi } from '@/lib/notifications/critical-alert-feedback';
import { CriticalAlertsAllDialog } from '@/components/app/critical-alerts-all-dialog';
import { playMandatoryCriticalAlarm } from '@/lib/notifications/notification-sound';
import { SUPRA_AUDIO_UNLOCK_EVENT } from '@/lib/notifications/critical-sound-events';
import { cn } from '@/lib/utils/cn';

const POLL_MS = 5 * 60 * 1000;
const DETAIL_PREVIEW_LIMIT = 5;
const SCROLL_COLLAPSE_THRESHOLD_PX = 8;

async function fetchCriticalActive(): Promise<CriticalActiveAlertsResponse | null> {
  try {
    const r = await fetch('/api/notifications/critical-active', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const ct = r.headers.get('content-type') ?? '';
    if (!r.ok || !ct.includes('application/json')) return null;
    const json = (await r.json()) as CriticalActiveAlertsResponse;
    if (
      !Array.isArray(json.alerts) ||
      !Array.isArray(json.allAlerts) ||
      typeof json.criticalCount !== 'number' ||
      typeof json.warningCount !== 'number' ||
      !json.totals ||
      typeof json.totals.totalActionableCount !== 'number' ||
      typeof json.fingerprint !== 'string'
    ) {
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

function alertFingerprint(p: CriticalActiveAlertsResponse): string {
  return p.fingerprint || p.allAlerts.map((a) => a.id).sort().join('|');
}

const btnSm =
  'h-8 min-h-0 shrink-0 rounded-[10px] px-2.5 text-xs font-medium sm:h-9 sm:px-3';

export function GlobalCriticalAlertBar() {
  const pathname = usePathname();
  const [payload, setPayload] = useState<CriticalActiveAlertsResponse | null>(null);
  const [snoozeTick, setSnoozeTick] = useState(0);
  const [uiState, setUiState] = useState<'compact' | 'hidden'>('compact');
  const [detailOpen, setDetailOpen] = useState(false);
  const [allDialogOpen, setAllDialogOpen] = useState(false);
  const payloadRef = useRef<CriticalActiveAlertsResponse | null>(null);
  const lastAlertFingerprintRef = useRef('');
  const lastAcknowledgedFingerprintRef = useRef('');
  const scrollYAtDetailOpenRef = useRef(0);

  const maybePlayFeedback = useCallback((p: CriticalActiveAlertsResponse | null, mode: 'ambient') => {
    if (!p || p.criticalCount === 0 || isSnoozed()) return;
    triggerCriticalAlertFeedbackFromActiveApi(p, mode);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await fetchCriticalActive();
      if (cancelled) return;
      setPayload(p);
      payloadRef.current = p;
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, snoozeTick]);

  useEffect(() => {
    if (!payload) return;
    const fp = alertFingerprint(payload);
    const record = readCriticalAlertBarState();
    const resolved = resolveCriticalAlertBarUiState(fp, record);
    setUiState(resolved);

    if (fp !== lastAlertFingerprintRef.current) {
      setDetailOpen(false);
      lastAlertFingerprintRef.current = fp;
    }

    if (!isSnoozed() && resolved === 'compact' && payload.totals.totalActionableCount > 0) {
      if (fp !== lastAcknowledgedFingerprintRef.current) {
        acknowledgeCriticalAlertsShownInBanner(payload);
        lastAcknowledgedFingerprintRef.current = fp;
      }
    }
  }, [payload]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void (async () => {
        const p = await fetchCriticalActive();
        const prevFp = payloadRef.current ? alertFingerprint(payloadRef.current) : '';
        const nextFp = p ? alertFingerprint(p) : '';
        if (p && p.criticalCount > 0 && !isSnoozed() && nextFp !== prevFp) {
          maybePlayFeedback(p, 'ambient');
        }
        setPayload(p);
        payloadRef.current = p;
      })();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [maybePlayFeedback]);

  useEffect(() => {
    const onUnlock = () => {
      const p = payloadRef.current;
      if (!p || p.criticalCount === 0 || isSnoozed()) return;
      try {
        playMandatoryCriticalAlarm({ skipMinGapForTest: true });
      } catch {
        // ignore
      }
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

  useEffect(() => {
    const onRefresh = () => {
      void (async () => {
        const p = await fetchCriticalActive();
        setPayload(p);
        payloadRef.current = p;
      })();
    };
    window.addEventListener(CRITICAL_ALERTS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(CRITICAL_ALERTS_REFRESH_EVENT, onRefresh);
  }, []);

  useEffect(() => {
    if (!detailOpen) return;

    scrollYAtDetailOpenRef.current = window.scrollY;

    const onScroll = () => {
      if (Math.abs(window.scrollY - scrollYAtDetailOpenRef.current) > SCROLL_COLLAPSE_THRESHOLD_PX) {
        setDetailOpen(false);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [detailOpen]);

  const fingerprint = useMemo(
    () => (payload && payload.totals.totalActionableCount > 0 ? alertFingerprint(payload) : ''),
    [payload],
  );

  if (!payload || payload.totals.totalActionableCount === 0) return null;
  if (isSnoozed()) return null;

  const { alerts, allAlerts, criticalCount, totals, scopeHint } = payload;

  const shortTitle = formatActionableBannerTitle(totals, scopeHint);

  const shortSubtitle =
    criticalCount > 0 ? summarizeCriticalAlertTotals(totals) : 'À traiter aujourd’hui';

  const barSurface = cn(
    'border-b border-border bg-background text-foreground',
    criticalCount > 0
      ? 'dark:border-[rgba(255,106,42,0.18)]'
      : '',
  );

  const iconWrap = cn(
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60',
    criticalCount > 0
      ? 'bg-[rgba(255,106,42,0.07)] text-[#FF6A2A] dark:border-[rgba(255,106,42,0.18)]'
      : 'bg-muted/40 text-muted-foreground',
  );

  const previewAlerts = alerts.slice(0, DETAIL_PREVIEW_LIMIT);
  const hasMoreAlerts = totals.totalActionableCount > previewAlerts.length;

  function setBarState(next: 'compact' | 'hidden') {
    persistCriticalAlertBarUiState(next, fingerprint);
    setUiState(next);
    setDetailOpen(false);
  }

  function toggleDetailPanel() {
    setDetailOpen((open) => !open);
  }

  if (uiState === 'hidden') {
    return (
      <div className={cn(barSurface, 'shadow-none')} role="status">
        <div className="mx-auto flex h-11 max-w-[1600px] items-center justify-between gap-2 px-3 sm:h-12 sm:px-6 lg:px-8">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {formatActionableBannerTitle(payload.totals, payload.scopeHint)}
            </span>
            {' · '}
            masquée — réapparaît si le jeu d’actions change
          </p>
          <Button
            type="button"
            variant="outline"
            className={cn(btnSm, 'border-border bg-background')}
            onClick={() => setBarState('compact')}
          >
            Afficher
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(barSurface, 'relative shadow-none')} role="status" aria-live="polite">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-[44px] flex-col gap-2 py-2 sm:min-h-[48px] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
            <span className={iconWrap} aria-hidden>
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium leading-tight text-foreground sm:text-sm">
                <span className="font-semibold">{shortTitle}</span>
                {shortSubtitle ? (
                  <>
                    <span className="mx-1.5 text-muted-foreground/70" aria-hidden>
                      ·
                    </span>
                    <span className="font-normal text-muted-foreground">{shortSubtitle}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-1 sm:justify-end sm:gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(btnSm, 'border-border bg-background')}
              aria-expanded={detailOpen}
              onClick={toggleDetailPanel}
            >
              {detailOpen ? (
                <>
                  <ChevronUp className="mr-0.5 h-3.5 w-3.5 opacity-70" aria-hidden />
                  Fermer
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
              className={cn(btnSm, 'border-border bg-background')}
              onClick={() => setBarState('hidden')}
            >
              Masquer
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
          <div className="mb-2 max-h-[220px] overflow-y-auto rounded-xl border border-border bg-card py-2 pl-2 pr-1 shadow-sm">
            <ul className="space-y-1.5 pr-1">
              {previewAlerts.map((a: CriticalActiveAlertDTO) => (
                <li key={a.id}>
                  <div className="flex flex-col gap-1 rounded-lg px-2 py-1.5 hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-[10px] font-semibold uppercase tracking-wide',
                          a.severity === 'critical'
                            ? 'text-[#C2410C] dark:text-[#FF6A2A]'
                            : 'text-muted-foreground',
                        )}
                      >
                        {a.title}
                      </p>
                      <p className="line-clamp-2 text-xs leading-snug text-foreground">{a.message}</p>
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
            {hasMoreAlerts ? (
              <div className="mt-2 border-t border-border px-2 pt-2">
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setAllDialogOpen(true)}
                >
                  Voir toutes les actions ({totals.totalActionableCount})
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <CriticalAlertsAllDialog
        open={allDialogOpen}
        onOpenChange={setAllDialogOpen}
        alerts={allAlerts.length ? allAlerts : alerts}
        totalCount={totals.totalActionableCount}
      />
    </div>
  );
}
