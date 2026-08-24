/**
 * Visuels animés de l'onboarding — légers et natifs.
 * Une seule Animated.Value pilote le flottement ambiant (page 1) ; les pages
 * 2 et 3 jouent une apparition en cascade quand elles deviennent actives.
 * Toutes les animations utilisent le native driver (opacity / translate).
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/glass-card';
import { colors, radius, spacing } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const STAGE_HEIGHT = 268;
/** iPhone SE / 8 ≈ 667 pt, 13 mini = 812 pt : en dessous du seuil on compacte. */
const COMPACT_SCREEN_HEIGHT = 720;
const COMPACT_SCALE = 0.86;

/**
 * Socle du visuel. Sur petit écran on met le visuel à l'échelle plutôt que de
 * réduire sa hauteur : aucun élément n'est retiré ni rogné, la composition
 * reste identique. Le conteneur adopte la hauteur réellement occupée après
 * mise à l'échelle (transform-origin = centre).
 */
function Stage({ children, column = false }: { children: React.ReactNode; column?: boolean }) {
  const { height } = useWindowDimensions();
  const scale = height < COMPACT_SCREEN_HEIGHT ? COMPACT_SCALE : 1;

  return (
    <View style={[styles.stageOuter, { height: STAGE_HEIGHT * scale }]}>
      <View
        style={[
          styles.stage,
          column && styles.stageColumn,
          scale !== 1 && { transform: [{ scale }] },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** Cascade d'apparition (opacity + léger translate) déclenchée à l'activation. */
function useStagger(count: number, active: boolean) {
  const values = useRef(
    Array.from({ length: count }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (!active) return;
    const anim = Animated.stagger(
      90,
      values.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 420, useNativeDriver: true }),
      ),
    );
    anim.start();
    return () => anim.stop();
  }, [active, values]);

  return values;
}

function stagStyle(v: Animated.Value) {
  return {
    opacity: v,
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
    ],
  };
}

// ─── Page 1 : cartes verre flottantes ────────────────────────────────────────

const PILLARS: { label: string; icon: IoniconName; tint: string; offset: number }[] = [
  { label: 'Projet', icon: 'briefcase-outline', tint: '#6D7FB5', offset: -7 },
  { label: 'Vidéo', icon: 'videocam-outline', tint: '#4FA3A0', offset: 6 },
  { label: 'Planning', icon: 'calendar-outline', tint: colors.orange, offset: -4 },
  { label: 'Stats', icon: 'stats-chart-outline', tint: '#8B7BB8', offset: 8 },
];

export function WelcomeVisual({ active }: { active: boolean }) {
  const float = useRef(new Animated.Value(0)).current;
  const items = useStagger(PILLARS.length, active);

  useEffect(() => {
    // Boucle ambiante unique : 4 cartes dérivent d'une seule valeur animée.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  return (
    <Stage>
      <View style={styles.logoMark}>
        <Text style={styles.logoText}>S</Text>
      </View>

      <View style={styles.pillarGrid}>
        {PILLARS.map((p, i) => (
          <Animated.View
            key={p.label}
            style={[
              styles.pillarSlot,
              {
                opacity: items[i],
                // Apparition en cascade + dérive ambiante composées.
                transform: [
                  {
                    translateY: items[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                  {
                    translateY: float.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, p.offset],
                    }),
                  },
                ],
              },
            ]}
          >
            <GlassCard borderRadius={radius.md}>
              <View style={styles.pillarInner}>
                <View style={[styles.pillarIcon, { backgroundColor: `${p.tint}18` }]}>
                  <Ionicons name={p.icon} size={16} color={p.tint} />
                </View>
                <Text style={styles.pillarLabel}>{p.label}</Text>
              </View>
            </GlassCard>
          </Animated.View>
        ))}
      </View>
    </Stage>
  );
}

// ─── Page 2 : timeline de production ────────────────────────────────────────

const STEPS: { label: string; tint: string; done: boolean }[] = [
  { label: 'Tournage prévu', tint: '#4FA3A0', done: true },
  { label: 'En montage', tint: colors.orange, done: true },
  { label: 'En validation', tint: '#C49A4B', done: false },
  { label: 'Validé', tint: '#2FA26E', done: false },
];

export function TimelineVisual({ active }: { active: boolean }) {
  const items = useStagger(STEPS.length, active);

  return (
    <Stage column>
      {STEPS.map((s, i) => (
        <Animated.View key={s.label} style={[styles.stepRow, stagStyle(items[i])]}>
          <View style={styles.stepRail}>
            <View style={[styles.stepDot, { backgroundColor: s.tint }]}>
              {s.done ? <Ionicons name="checkmark" size={10} color={colors.white} /> : null}
            </View>
            {i < STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
          </View>
          <GlassCard style={styles.stepCard} borderRadius={radius.md}>
            <View style={styles.stepInner}>
              <View style={[styles.stepAccent, { backgroundColor: s.tint }]} />
              <Text style={styles.stepLabel}>{s.label}</Text>
              {s.done ? (
                <Ionicons name="checkmark-circle" size={15} color={s.tint} />
              ) : (
                <View style={[styles.stepPending, { borderColor: s.tint }]} />
              )}
            </View>
          </GlassCard>
        </Animated.View>
      ))}
    </Stage>
  );
}

// ─── Page 3 : mini tableau de bord ──────────────────────────────────────────

const DASH: { label: string; value: string; icon: IoniconName; tint: string }[] = [
  { label: 'Prochain tournage', value: 'Jeu. 09:00', icon: 'videocam-outline', tint: '#4FA3A0' },
  { label: 'En attente de validation', value: '2 vidéos', icon: 'eye-outline', tint: '#C49A4B' },
  { label: 'Livraison prévue', value: 'Vendredi', icon: 'paper-plane-outline', tint: colors.orange },
];

export function DashboardVisual({ active }: { active: boolean }) {
  const items = useStagger(DASH.length + 1, active);
  const perf = items[DASH.length];
  const bars = useMemo(() => [38, 54, 44, 68, 58, 82], []);

  return (
    <Stage column>
      {DASH.map((d, i) => (
        <Animated.View key={d.label} style={[styles.dashRow, stagStyle(items[i])]}>
          <GlassCard borderRadius={radius.md}>
            <View style={styles.dashInner}>
              <View style={[styles.dashIcon, { backgroundColor: `${d.tint}18` }]}>
                <Ionicons name={d.icon} size={15} color={d.tint} />
              </View>
              <Text style={styles.dashLabel} numberOfLines={1}>
                {d.label}
              </Text>
              <Text style={styles.dashValue}>{d.value}</Text>
            </View>
          </GlassCard>
        </Animated.View>
      ))}

      <Animated.View style={[styles.dashRow, stagStyle(perf)]}>
        <GlassCard borderRadius={radius.md} accent>
          <View style={styles.perfInner}>
            <View style={styles.perfHead}>
              <Text style={styles.dashLabel}>Performance contenu</Text>
              <Text style={styles.perfDelta}>+18 %</Text>
            </View>
            <View style={styles.perfBars}>
              {bars.map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.perfBar,
                    { height: h * 0.42, opacity: 0.35 + i * 0.11 },
                  ]}
                />
              ))}
            </View>
          </View>
        </GlassCard>
      </Animated.View>
    </Stage>
  );
}

const styles = StyleSheet.create({
  stageOuter: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  stage: {
    height: STAGE_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageColumn: { justifyContent: 'center', gap: spacing.sm },

  // Page 1
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoText: { color: colors.orange, fontSize: 26, fontWeight: '800' },
  pillarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm + 2,
  },
  pillarSlot: { width: 104 },
  pillarInner: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  pillarIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarLabel: { fontSize: 12.5, fontWeight: '700', color: colors.textPrimary },

  // Page 2
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2 },
  stepRail: { width: 18, alignItems: 'center' },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
  },
  stepLine: { width: 2, flex: 1, minHeight: 18, backgroundColor: colors.separator },
  stepCard: { flex: 1 },
  stepInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 3,
    paddingHorizontal: spacing.sm + 2,
  },
  stepAccent: { width: 3, height: 20, borderRadius: 2 },
  stepLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  stepPending: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5 },

  // Page 3
  dashRow: { alignSelf: 'stretch' },
  dashInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
  },
  dashIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashLabel: { flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.textSecondary },
  dashValue: { fontSize: 12.5, fontWeight: '700', color: colors.textPrimary },
  perfInner: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm + 2, gap: spacing.sm },
  perfHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  perfDelta: { fontSize: 12.5, fontWeight: '800', color: colors.success },
  perfBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 36 },
  perfBar: { flex: 1, borderRadius: 3, backgroundColor: colors.orange },
});
