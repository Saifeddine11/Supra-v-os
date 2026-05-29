import {
  CRITICAL_ALERT_BAR_STATE_KEY,
  CRITICAL_BAR_MINIMIZED_KEY,
  CRITICAL_BAR_SUPPRESS_FP_KEY,
  type CriticalAlertBarStateRecord,
  type CriticalAlertBarUiState,
} from '@/lib/notifications/critical-bar-constants';

function readRaw(): CriticalAlertBarStateRecord | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CRITICAL_ALERT_BAR_STATE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CriticalAlertBarStateRecord;
    if (parsed && typeof parsed.state === 'string' && typeof parsed.updatedAt === 'number') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Migration depuis les clés legacy (minimized + suppress fingerprint). */
function migrateLegacyState(): CriticalAlertBarStateRecord {
  let state: CriticalAlertBarUiState = 'compact';
  let lastFingerprint: string | undefined;

  if (localStorage.getItem(CRITICAL_BAR_MINIMIZED_KEY) === '1') {
    state = 'hidden';
  }
  const suppressFp = localStorage.getItem(CRITICAL_BAR_SUPPRESS_FP_KEY);
  if (suppressFp) {
    state = 'hidden';
    lastFingerprint = suppressFp;
  }

  return { state, lastFingerprint, updatedAt: Date.now() };
}

export function readCriticalAlertBarState(): CriticalAlertBarStateRecord {
  const existing = readRaw();
  if (existing) {
    if (existing.state === 'expanded') {
      const migrated: CriticalAlertBarStateRecord = { ...existing, state: 'compact', updatedAt: Date.now() };
      writeCriticalAlertBarState(migrated);
      return migrated;
    }
    return existing;
  }
  if (typeof window === 'undefined') return { state: 'compact', updatedAt: 0 };
  const migrated = migrateLegacyState();
  writeCriticalAlertBarState(migrated);
  return migrated;
}

export function writeCriticalAlertBarState(record: CriticalAlertBarStateRecord): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CRITICAL_ALERT_BAR_STATE_KEY, JSON.stringify(record));
}

export function resolveCriticalAlertBarUiState(
  fingerprint: string,
  record: CriticalAlertBarStateRecord,
): 'compact' | 'hidden' {
  if (record.state === 'hidden' && record.lastFingerprint && record.lastFingerprint !== fingerprint) {
    return 'compact';
  }
  if (record.state === 'hidden') return 'hidden';
  return 'compact';
}

export function persistCriticalAlertBarUiState(
  state: CriticalAlertBarUiState,
  fingerprint: string,
  userId?: string | null,
): void {
  const persistedState: CriticalAlertBarUiState = state === 'expanded' ? 'compact' : state;
  writeCriticalAlertBarState({
    userId: userId ?? undefined,
    state: persistedState,
    lastFingerprint: state === 'hidden' ? fingerprint : undefined,
    updatedAt: Date.now(),
  });
}
