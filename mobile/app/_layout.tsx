import React, { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '@/hooks/useAuth';
import { configureNotificationHandler, routeForPushData } from '@/lib/push-notifications';
import { colors } from '@/constants/theme';

/**
 * Ouverture d'une notification push → écran concerné.
 * Navigation prudente : tâche/vidéo connues → détail ; sinon centre de
 * notifications. Couvre l'app en arrière-plan ET l'app fermée (cold start
 * via getLastNotificationResponseAsync).
 */
function usePushNavigation() {
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Configuration + écoute natives APRÈS le premier rendu, jamais à
    // l'import : une exception ici ne peut plus empêcher l'app de démarrer.
    configureNotificationHandler();

    const open = (response: Notifications.NotificationResponse | null) => {
      if (!mounted || !response) return;
      const id = response.notification.request.identifier;
      if (handled.current === id) return; // évite le double traitement au démarrage
      handled.current = id;
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      router.push(routeForPushData(data));
    };

    let sub: Notifications.EventSubscription | null = null;
    try {
      // App fermée : notification ayant lancé l'app.
      Notifications.getLastNotificationResponseAsync()
        .then(open)
        .catch(() => {});

      // App ouverte / en arrière-plan.
      sub = Notifications.addNotificationResponseReceivedListener(open);
    } catch {
      // Module natif indisponible : la navigation par notification est
      // simplement inactive, l'app reste utilisable.
    }

    return () => {
      mounted = false;
      sub?.remove();
    };
  }, [router]);
}

function RootNavigator() {
  usePushNavigation();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.offWhite },
      }}
    >
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(client)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
