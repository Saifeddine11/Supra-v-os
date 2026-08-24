/**
 * Protected tabs: Accueil, Tâches, Calendrier, Vidéos, Profil.
 * Barre de navigation « liquid glass » flottante (components/liquid-tab-bar).
 * Tabs are hidden (href: null) per role, mirroring the web nav-policy:
 * Tâches/Calendrier hidden for finance & commercial, Vidéos visible only to
 * admin/PM/editor/cameraman/community_manager — RLS remains the enforcement.
 */
import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { hasTaskAccess, hasVideoAccess } from '@/lib/roles';
import { LiquidTabBar } from '@/components/liquid-tab-bar';
import { colors } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(active: IconName, inactive: IconName) {
  return ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}

export default function TabsLayout() {
  const { initializing, session, employee } = useAuth();

  if (!initializing && (!session || !employee)) {
    return <Redirect href="/(auth)/login" />;
  }

  const role = employee?.role ?? null;

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
        options={{
          title: 'Accueil',
          tabBarIcon: icon('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tâches',
          href: hasTaskAccess(role) ? '/(tabs)/tasks' : null,
          tabBarIcon: icon('checkmark-circle', 'checkmark-circle-outline'),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendrier',
          href: hasTaskAccess(role) ? '/(tabs)/calendar' : null,
          tabBarIcon: icon('calendar', 'calendar-outline'),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: 'Vidéos',
          href: hasVideoAccess(role) ? '/(tabs)/videos' : null,
          tabBarIcon: icon('videocam', 'videocam-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: icon('person-circle', 'person-circle-outline'),
        }}
      />
    </Tabs>
  );
}
