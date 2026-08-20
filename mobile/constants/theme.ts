/**
 * Supra design tokens (mobile).
 * Mirrors the web identity (CLAUDE.md) — clean off-white surfaces, orange accent.
 */
export const colors = {
  orange: '#FF3D0A',
  orangeAlt: '#FF450F',
  orangeGlow: '#FF6A2A',
  black: '#080706',
  brownBlack: '#1A0703',
  offWhite: '#F8F4EF',
  white: '#FFFFFF',
  muted: '#A8A19A',
  border: '#E8E2DA',
  danger: '#D64545',
  success: '#3DBD7D',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;
