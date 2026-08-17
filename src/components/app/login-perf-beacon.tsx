'use client';

import { useEffect } from 'react';

function clientPerfEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_PERF_LOGIN_LOGS === 'true'
  );
}

/**
 * Client beacon for login-to-shell timing. No-op in production builds
 * unless NEXT_PUBLIC_PERF_LOGIN_LOGS was set at build time.
 */
export function LoginPerfBeacon({ label }: { label: string }) {
  useEffect(() => {
    if (!clientPerfEnabled()) return;

    console.info(`[perf] ${label}`);

    const clickAt = Number(sessionStorage.getItem('login-perf-t0') ?? '');
    if (Number.isFinite(clickAt) && clickAt > 0) {
      console.info(`[login-perf] click to ${label}: ${Date.now() - clickAt} ms`);
    }

    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      console.info(
        `[login-perf] document responseStart: ${Math.round(nav.responseStart)} ms, ` +
          `domContentLoaded: ${Math.round(nav.domContentLoadedEventEnd)} ms`,
      );
    }
  }, [label]);

  return null;
}
