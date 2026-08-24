/**
 * Mise en page d'une page d'onboarding : visuel animé, titre, description.
 * Le contenu défile avec la page ; pagination et CTA restent fixes en bas.
 */
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, spacing } from '@/constants/theme';

export function OnboardingSlide({
  width,
  title,
  description,
  children,
}: {
  width: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  // Petit écran (SE / 8) : on resserre l'écart visuel ↔ texte, sans rien retirer.
  const compact = height < 720;

  return (
    <View style={[styles.page, { width }]} accessible={false}>
      <View style={styles.visual}>{children}</View>
      <View style={[styles.copy, compact && styles.copyCompact]}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  visual: { justifyContent: 'center' },
  copy: { marginTop: spacing.xl, gap: spacing.sm + 2 },
  copyCompact: { marginTop: spacing.md, gap: spacing.sm },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 34,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
