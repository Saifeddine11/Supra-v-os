import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/constants/theme';

export default function AuthLayout() {
  const { initializing, session, employee } = useAuth();

  // Already signed in with a valid profile → straight to the app.
  if (!initializing && session && employee) {
    return <Redirect href="/(tabs)" />;
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
