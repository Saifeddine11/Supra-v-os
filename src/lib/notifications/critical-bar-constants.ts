/** Aligné avec `GlobalCriticalAlertBar` — masquage temporaire 2 h. */
export const CRITICAL_BAR_SNOOZE_KEY = 'supra_critical_bar_snooze_until';

/** Barre réduite (fine) — préférence locale. */
export const CRITICAL_BAR_MINIMIZED_KEY = 'supra_critical_bar_minimized_v1';

/** Masquage par fingerprint : réapparaît si le jeu d’alertes critiques change. */
export const CRITICAL_BAR_SUPPRESS_FP_KEY = 'supra_critical_bar_suppress_fp_v1';

/** Empreintes d’alertes déjà signalées (toast) — persiste entre rechargements. */
export const CRITICAL_ALERT_TOAST_SEEN_KEY = 'supra_critical_alert_toast_seen_v1';

/** État unifié barre d’alertes : compact | hidden | expanded (+ fingerprint). */
export const CRITICAL_ALERT_BAR_STATE_KEY = 'supra_critical_alert_bar_state_v1';

export type CriticalAlertBarUiState = 'compact' | 'hidden' | 'expanded';

export type CriticalAlertBarStateRecord = {
  userId?: string;
  state: CriticalAlertBarUiState;
  lastFingerprint?: string;
  updatedAt: number;
};
