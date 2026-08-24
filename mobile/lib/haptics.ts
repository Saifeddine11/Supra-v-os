/**
 * Safe haptic feedback helpers — no-ops on unsupported devices/errors.
 */
import * as Haptics from 'expo-haptics';

export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticError(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export function hapticLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticSelection(): void {
  Haptics.selectionAsync().catch(() => {});
}
