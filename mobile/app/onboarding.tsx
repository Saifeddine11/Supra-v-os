/**
 * Onboarding premier lancement — 3 pages « liquid glass » animées.
 *
 * Affiché uniquement si le flag local n'est pas posé (voir app/index.tsx) :
 *   session valide → app · sinon onboarding non vu → ici · sinon → login.
 * Aucune logique d'authentification ici : la page pose le flag puis renvoie
 * vers le flux de connexion existant.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmbientBackground } from '@/components/glass-card';
import { OnboardingSlide } from '@/components/onboarding-slide';
import {
  DashboardVisual,
  TimelineVisual,
  WelcomeVisual,
} from '@/components/onboarding-visuals';
import { PrimaryButton } from '@/components/ui';
import { setOnboardingCompleted } from '@/lib/onboarding-storage';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { colors, layout, spacing } from '@/constants/theme';

const SLIDES = [
  {
    key: 'welcome',
    title: 'Bienvenue sur Supra v OS',
    description:
      'Un espace unique pour suivre vos projets, vos vidéos, vos validations, vos plannings et les performances de vos contenus en diffusion.',
    cta: 'Continuer',
  },
  {
    key: 'timeline',
    title: 'Suivez chaque étape',
    description:
      'Tournage, montage, validation, livraison : chaque contenu avance avec un statut clair et une timeline simple.',
    cta: 'Continuer',
  },
  {
    key: 'clarity',
    title: 'Moins de messages. Plus de clarté.',
    description:
      'Retrouvez l’avancement, les prochains tournages, les livraisons, les validations et les statistiques importantes au même endroit.',
    cta: 'Commencer',
  },
] as const;

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const scrollRef = useRef<Animated.FlatList<unknown> | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(next, SLIDES.length - 1));
      scrollRef.current?.scrollToOffset({ offset: target * width, animated: true });
      setIndex(target);
    },
    [width],
  );

  const finish = useCallback(async () => {
    hapticLight();
    await setOnboardingCompleted();
    router.replace('/(auth)/login');
  }, [router]);

  const onNext = useCallback(() => {
    if (isLast) {
      void finish();
      return;
    }
    hapticSelection();
    goTo(index + 1);
  }, [finish, goTo, index, isLast]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex((prev) => (prev === next ? prev : next));
    },
    [width],
  );

  const renderVisual = (key: (typeof SLIDES)[number]['key'], active: boolean) => {
    if (key === 'welcome') return <WelcomeVisual active={active} />;
    if (key === 'timeline') return <TimelineVisual active={active} />;
    return <DashboardVisual active={active} />;
  };

  return (
    <View style={styles.flex}>
      <AmbientBackground />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        {!isLast ? (
          <Pressable
            onPress={() => void finish()}
            accessibilityRole="button"
            accessibilityLabel="Passer l’introduction"
            hitSlop={10}
            style={({ pressed }) => [styles.skip, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.skipText}>Passer</Text>
          </Pressable>
        ) : null}
      </View>

      <Animated.FlatList
        ref={scrollRef}
        data={SLIDES as unknown as (typeof SLIDES)[number][]}
        keyExtractor={(item) => (item as (typeof SLIDES)[number]).key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item, index: i }) => {
          const slide = item as (typeof SLIDES)[number];
          return (
            <OnboardingSlide
              width={width}
              title={slide.title}
              description={slide.description}
            >
              {renderVisual(slide.key, i === index)}
            </OnboardingSlide>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View
          style={styles.dots}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {SLIDES.map((s, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0, 1, 0],
              extrapolate: 'clamp',
            });
            const scaleX = scrollX.interpolate({
              inputRange,
              outputRange: [1, 2.6, 1],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View key={s.key} style={[styles.dotWrap, { transform: [{ scaleX }] }]}>
                <View style={styles.dotBase} />
                <Animated.View style={[styles.dotActive, { opacity }]} />
              </Animated.View>
            );
          })}
        </View>

        <PrimaryButton
          title={SLIDES[index].cta}
          onPress={onNext}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  topBar: {
    paddingHorizontal: spacing.lg,
    minHeight: layout.touch + spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skip: {
    minHeight: layout.touch,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  skipText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  footer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dotWrap: { width: 7, height: 7 },
  dotBase: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: colors.muted,
    opacity: 0.45,
  },
  dotActive: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: colors.orange,
  },
});
