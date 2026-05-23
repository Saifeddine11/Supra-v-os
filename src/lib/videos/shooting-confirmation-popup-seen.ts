/** Popup auto « confirmation de tournage » — max 1×/jour/utilisateur (empreintes vidéo + date tournage). */
export const SHOOTING_CONFIRMATION_POPUP_SEEN_KEY = 'supra_shooting_confirmation_popup_seen_v1';

export type ShootingConfirmationPopupSeen = {
  userId: string;
  date: string;
  seenFingerprints: string[];
  lastShownAt?: string;
};

export function shootingConfirmationFingerprint(videoId: string, shootingAt: string): string {
  return `${videoId}:${shootingAt}`;
}

export function fingerprintFromQueueItem(item: { id: string; shootingDate: string }): string {
  return shootingConfirmationFingerprint(item.id, item.shootingDate);
}

/** Date locale YYYY-MM-DD (pas UTC) pour le quota journalier. */
export function todayDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function readShootingConfirmationPopupSeen(): ShootingConfirmationPopupSeen | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SHOOTING_CONFIRMATION_POPUP_SEEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShootingConfirmationPopupSeen;
    if (!parsed?.userId || !parsed?.date || !Array.isArray(parsed.seenFingerprints)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeShootingConfirmationPopupSeen(data: ShootingConfirmationPopupSeen): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SHOOTING_CONFIRMATION_POPUP_SEEN_KEY, JSON.stringify(data));
}

export function getSeenFingerprintsForToday(userId: string): Set<string> {
  const today = todayDateKey();
  const stored = readShootingConfirmationPopupSeen();
  if (!stored || stored.userId !== userId || stored.date !== today) {
    return new Set();
  }
  return new Set(stored.seenFingerprints);
}

export function getUnseenShootingFingerprints(
  userId: string,
  queue: { id: string; shootingDate: string }[],
): string[] {
  const seen = getSeenFingerprintsForToday(userId);
  const out: string[] = [];
  for (const item of queue) {
    const fp = fingerprintFromQueueItem(item);
    if (!seen.has(fp)) out.push(fp);
  }
  return out;
}

export function markShootingFingerprintsSeen(userId: string, fingerprints: string[]): void {
  if (fingerprints.length === 0) return;
  const today = todayDateKey();
  const stored = readShootingConfirmationPopupSeen();
  const seen = new Set<string>(
    stored?.userId === userId && stored?.date === today ? stored.seenFingerprints : [],
  );
  for (const fp of fingerprints) seen.add(fp);
  writeShootingConfirmationPopupSeen({
    userId,
    date: today,
    seenFingerprints: [...seen],
    lastShownAt: new Date().toISOString(),
  });
}

export function markShootingQueueSeen(userId: string, queue: { id: string; shootingDate: string }[]): void {
  markShootingFingerprintsSeen(
    userId,
    queue.map((item) => fingerprintFromQueueItem(item)),
  );
}

export function shouldAutoShowShootingConfirmationPopup(
  userId: string,
  queue: { id: string; shootingDate: string }[],
): boolean {
  return getUnseenShootingFingerprints(userId, queue).length > 0;
}
