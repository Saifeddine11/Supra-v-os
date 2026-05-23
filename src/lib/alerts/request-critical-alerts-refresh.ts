/** Déclenché après résolution métier (tâche terminée, tournage confirmé, etc.) pour rafraîchir la bannière. */
export const CRITICAL_ALERTS_REFRESH_EVENT = 'supra-critical-alerts-refresh';

export function requestCriticalAlertsRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CRITICAL_ALERTS_REFRESH_EVENT));
}
