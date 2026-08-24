/**
 * Entry gate: waits for the persisted session and the local onboarding flag,
 * then routes. This is the mobile "protected route" root — (tabs)/_layout.tsx
 * re-checks on every render as well.
 *
 * Ordre volontaire :
 *   1. session valide → espace correspondant au type de compte
 *      (staff → /(tabs), client → /(client)). Un utilisateur connecté n'est
 *      jamais bloqué par l'onboarding, y compris après mise à jour ;
 *   2. onboarding jamais vu → onboarding ;
 *   3. sinon → login.
 * La déconnexion renvoie directement vers /(auth)/login (voir profile.tsx),
 * donc elle ne réaffiche jamais l'onboarding.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useOnboardingStatus } from '@/lib/onboarding-storage';
import { colors } from '@/constants/theme';

export default function Index() {
  const { initializing, session, employee, accountType } = useAuth();
  const { loading: onboardingLoading, completed } = useOnboardingStatus();

  if (initializing || onboardingLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.orange} />
      </View>
    );
  }

  if (session && accountType === 'staff' && employee) {
    return <Redirect href="/(tabs)" />;
  }
  if (session && accountType === 'client') {
    return <Redirect href="/(client)" />;
  }
  if (!completed) {
    return <Redirect href="/onboarding" />;
  }
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.offWhite,
  },
});
