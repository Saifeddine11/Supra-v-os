/**
 * Espace CLIENT — onglets dédiés, strictement séparés du staff.
 *
 * Aucune vue interne n'est accessible ici : ni tâches, ni calendrier équipe,
 * ni vidéos internes, ni notifications internes, ni finance, ni admin.
 * La séparation est garantie côté serveur (`auth_client_id()` renvoie null dès
 * qu'une ligne `employees` existe) ; ce garde-fou est la couche UI.
 */
import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { LiquidTabBar } from '@/components/liquid-tab-bar';
import { colors } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(active: IconName, inactive: IconName) {
  return ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}

export default function ClientLayout() {
  const { initializing, session, accountType } = useAuth();

  if (!initializing) {
    if (!session || !accountType) return <Redirect href="/(auth)/login" />;
    // Un compte staff ne doit jamais entrer dans l'espace client.
    if (accountType === 'staff') return <Redirect href="/(tabs)" />;
  }

  return (
    <Tabs
      tabBar={(props) => <LiquidTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.offWhite },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Accueil', tabBarIcon: icon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="projects"
        options={{ title: 'Projets', tabBarIcon: icon('folder', 'folder-outline') }}
      />
      <Tabs.Screen
        name="videos"
        options={{ title: 'Vidéos', tabBarIcon: icon('videocam', 'videocam-outline') }}
      />
      <Tabs.Screen
        name="planning"
        options={{ title: 'Planning', tabBarIcon: icon('calendar', 'calendar-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: icon('person-circle', 'person-circle-outline') }}
      />
      {/* Détail projet : route enfant, jamais un onglet. */}
      <Tabs.Screen name="projects/[id]" options={{ href: null }} />
    </Tabs>
  );
}
