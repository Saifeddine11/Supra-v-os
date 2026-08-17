/** Dev-only timing. Silent in production. */
export async function withDevTime<T>(label: string, run: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV !== 'development') {
    return run();
  }
  const start = performance.now();
  try {
    return await run();
  } finally {
    console.info(`[perf] ${label} ${Math.round(performance.now() - start)}ms`);
  }
}
