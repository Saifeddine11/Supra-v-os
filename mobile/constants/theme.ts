/**
 * Supra design tokens (mobile) — iOS-flavored system.
 * Warm off-white ground, white elevated surfaces, Supra orange accent,
 * soft semantic tints, hairline separators, Apple-like type scale.
 */
import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  // Brand
  orange: '#FF3D0A',
  orangeAlt: '#FF450F',
  orangeGlow: '#FF6A2A',
  orangeSoft: '#FFF1EC',
  black: '#080706',
  brownBlack: '#1A0703',

  // Ground & surfaces
  offWhite: '#F8F4EF',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  fill: '#EFE9E2',            // iOS-style quiet input/search fill

  // Text
  textPrimary: '#0B0908',
  textSecondary: '#6E6660',
  muted: '#A8A19A',

  // Lines
  border: '#EAE4DC',
  separator: 'rgba(26, 7, 3, 0.08)',

  // Semantic (soft)
  danger: '#D64545',
  dangerSoft: '#FBEFED',
  success: '#2FA26E',
  successSoft: '#ECF6F0',
  warning: '#D98E2B',
  warningSoft: '#FBF3E6',
  info: '#5E6F96',
  infoSoft: '#EFF1F6',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  full: 999,
} as const;

export const layout = {
  /** Extra bottom padding under scroll content — clears the floating tab bar. */
  tabBarSpace: 132,
  /** Respiration sous la status bar avant un grand titre (s'ajoute à insets.top). */
  screenTop: 32,
  /** Minimum touch target (HIG). */
  touch: 44,
} as const;

/** Apple-like type scale. */
export const type = StyleSheet.create({
  largeTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: colors.textPrimary,
  } as TextStyle,
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary } as TextStyle,
  headline: { fontSize: 17, fontWeight: '600', color: colors.textPrimary } as TextStyle,
  body: { fontSize: 15, color: colors.textPrimary, lineHeight: 21 } as TextStyle,
  subhead: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' } as TextStyle,
  caption: { fontSize: 12, color: colors.textSecondary } as TextStyle,
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  } as TextStyle,
});

/** Soft floating-card shadow (very light on Android to avoid gray boxes). */
export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#1A0703',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  default: { elevation: 2 },
}) as ViewStyle;

/** Even softer shadow for chips / small controls. */
export const chipShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#1A0703',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  default: { elevation: 1 },
}) as ViewStyle;

/**
 * Liquid-glass tokens — floating tab bar / frosted surfaces.
 * Supra palette only : verre blanc translucide sur fond warm off-white,
 * capsule active graphite très sombre, accent orange Supra.
 */
export const glass = {
  /** Fond du conteneur verre (au-dessus du blur iOS / opaque-ish sur Android). */
  background: 'rgba(255, 255, 255, 0.62)',
  /** Repli Android (pas de blur) — plus opaque pour rester lisible. */
  backgroundSolid: 'rgba(255, 255, 255, 0.94)',
  /** Liseré clair qui donne l'effet « bord de verre ». */
  border: 'rgba(255, 255, 255, 0.65)',
  /** Reflet interne haut (glossy). */
  highlight: 'rgba(255, 255, 255, 0.55)',
  /** Couleur d'ombre portée (brun-noir Supra, jamais du gris pur). */
  shadow: '#1A0703',
  /** Force du flou iOS (expo-blur). Plus haut = verre plus prononcé. */
  blurIntensity: 62,
  /** Grandes cartes verre (onboarding, login) — plus dense donc lisible. */
  cardBackground: 'rgba(255, 255, 255, 0.78)',
  /** Surface verre appuyée (carte de connexion). */
  strongBackground: 'rgba(255, 255, 255, 0.88)',
  /** Liseré orange Supra discret sur une surface verre. */
  orangeBorder: 'rgba(255, 61, 10, 0.22)',
  /** Liseré orange affirmé — état focus d'un champ de saisie. */
  orangeBorderStrong: 'rgba(255, 61, 10, 0.55)',
  /** Flou des cartes décoratives (plus léger que la barre). */
  cardBlurIntensity: 45,
  /** Teinte du flou iOS. */
  blurTint: 'extraLight',
} as const;

export const tab = {
  /** Surface verre de la barre. */
  glass: glass.background,
  glassSolid: glass.backgroundSolid,
  glassBorder: glass.border,
  /** Capsule active : verre blanc chaud légèrement plus dense que la barre. */
  activeGlassBackground: 'rgba(255, 255, 255, 0.90)',
  /** Liseré orange Supra très discret autour de la capsule active. */
  activeGlassBorder: 'rgba(255, 61, 10, 0.24)',
  /** Icône active : orange Supra. */
  activeIcon: colors.orange,
  /** Libellé actif : graphite profond (contraste sûr sur le verre clair). */
  activeText: colors.textPrimary,
  /** Icône + libellé inactifs sur le verre. */
  inactiveText: colors.textSecondary,
} as const;

/** Métriques de la barre flottante (partagées avec layout.tabBarSpace). */
export const tabBar = {
  /** Hauteur de la pilule (zone tactile résultante : 54 pt > 44 pt HIG). */
  height: 70,
  /** Marge latérale. */
  sideMargin: 16,
  /** Écart minimum sous la pilule (au-dessus du home indicator). */
  bottomGap: 12,
  /** Rayon de la pilule (= moitié de la hauteur). */
  radius: 35,
  /** Rayon de la capsule active (= moitié de sa hauteur ⇒ capsule parfaite). */
  itemRadius: 23,
  /** Libellé standard (≤ 4 onglets visibles). */
  labelSize: 10.5,
  /** Libellé compact (5 onglets — évite la troncature sur iPhone SE). */
  labelSizeCompact: 9.5,
} as const;

/** Ombre douce et diffuse du conteneur verre. */
export const glassShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: glass.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  default: { elevation: 12 },
}) as ViewStyle;

/** Halo orange doux de la capsule active — élévation sans lourdeur. */
export const activeGlassShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: colors.orange,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  default: { elevation: 3 },
}) as ViewStyle;
