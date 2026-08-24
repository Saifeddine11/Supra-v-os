/**
 * Surfaces « liquid glass » réutilisables (onboarding / login).
 * iOS : BlurView + teinte translucide. Android : teinte plus opaque, sans
 * blur, pour rester lisible. Ombre portée sur un conteneur séparé (iOS
 * rognerait l'ombre avec overflow: hidden).
 */
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, glass, glassShadow, radius } from '@/constants/theme';

const IS_IOS = Platform.OS === 'ios';

export function GlassCard({
  children,
  style,
  strong = false,
  accent = false,
  borderRadius = radius.lg,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Surface plus dense (carte de connexion). */
  strong?: boolean;
  /** Liseré orange Supra au lieu du liseré blanc. */
  accent?: boolean;
  borderRadius?: number;
}) {
  const tint = strong ? glass.strongBackground : glass.cardBackground;

  return (
    <View style={[{ borderRadius }, glassShadow, style]}>
      <View style={[styles.clip, { borderRadius }]}>
        {IS_IOS ? (
          <BlurView
            intensity={glass.cardBlurIntensity}
            tint={glass.blurTint}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: IS_IOS ? tint : glass.backgroundSolid },
          ]}
          pointerEvents="none"
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.border,
            {
              borderRadius,
              borderColor: accent ? glass.orangeBorder : glass.border,
            },
          ]}
        />
        {children}
      </View>
    </View>
  );
}

/** Blobs colorés très doux en fond (pas de dégradé : aucune dépendance). */
export function AmbientBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.blob, styles.blobOrange]} />
      <View style={[styles.blob, styles.blobTeal]} />
      <View style={[styles.blob, styles.blobIndigo]} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', borderCurve: 'continuous' },
  border: { borderWidth: StyleSheet.hairlineWidth },
  blob: { position: 'absolute', borderRadius: 999 },
  blobOrange: {
    width: 320,
    height: 320,
    top: -110,
    right: -90,
    backgroundColor: colors.orange,
    opacity: 0.09,
  },
  blobTeal: {
    width: 280,
    height: 280,
    bottom: -80,
    left: -110,
    backgroundColor: '#4FA3A0',
    opacity: 0.08,
  },
  blobIndigo: {
    width: 200,
    height: 200,
    top: '42%',
    left: -70,
    backgroundColor: '#6D7FB5',
    opacity: 0.06,
  },
});
