/** Timing helpers. Silent in production unless an explicit diagnosis flag is set. */

export function isPerfLogEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.PERF_LOGIN_LOGS === '1' ||
    process.env.NEXT_PUBLIC_PERF_LOGIN_LOGS === 'true'
  );
}

export function isMinimalDashboardEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PERF_MINIMAL_DASHBOARD === 'true';
}

export function perfLog(line: string): void {
  if (!isPerfLogEnabled()) return;
  console.info(line);
}

export function perfMs(start: number): number {
  return Math.round(performance.now() - start);
}

/** Dev-only timing. Silent in production unless PERF_LOGIN_LOGS=1. */
export async function withDevTime<T>(label: string, run: () => Promise<T>): Promise<T> {
  if (!isPerfLogEnabled()) {
    return run();
  }
  const start = performance.now();
  try {
    return await run();
  } finally {
    console.info(`[perf] ${label}: ${perfMs(start)} ms`);
  }
}
