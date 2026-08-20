/**
 * Protected tabs: Accueil, Tâches, Calendrier, Vidéos, Profil.
 * Tabs are hidden (href: null) per role, mirroring the web nav-policy:
 * Tâches/Calendrier hidden for finance & commercial, Vidéos visible only to
 * admin/PM/editor/cameraman/community_manager — RLS remains the enforcement.
 */
import React from 'react';
import { Text } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { hasTaskAccess, hasVideoAccess } from '@/lib/roles';
import { colors } from '@/constants/theme';

function TabGlyph({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 22, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const { initializing, session, employee } = useAuth();

  if (!initializing && (!session || !employee)) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.offWhite },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <TabGlyph glyph="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tâches',
          href: hasTaskAccess(employee?.role ?? null) ? '/(tabs)/tasks' : null,
          tabBarIcon: ({ color }) => <TabGlyph glyph="☑" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendrier',
          href: hasTaskAccess(employee?.role ?? null) ? '/(tabs)/calendar' : null,
          tabBarIcon: ({ color }) => <TabGlyph glyph="▦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: 'Vidéos',
          href: hasVideoAccess(employee?.role ?? null) ? '/(tabs)/videos' : null,
          tabBarIcon: ({ color }) => <TabGlyph glyph="▶" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <TabGlyph glyph="◉" color={color} />,
        }}
      />
    </Tabs>
  );
}
