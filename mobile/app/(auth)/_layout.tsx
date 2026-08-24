import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/constants/theme';

export default function AuthLayout() {
  const { initializing, session, employee, accountType } = useAuth();

  // Déjà connecté → espace correspondant au type de compte.
  if (!initializing && session && accountType === 'staff' && employee) {
    return <Redirect href="/(tabs)" />;
  }
  if (!initializing && session && accountType === 'client') {
    return <Redirect href="/(client)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.offWhite },
      }}
    />
  );
}
