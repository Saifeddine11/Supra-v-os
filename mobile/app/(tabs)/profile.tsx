import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/lib/roles';
import { Card, ListRow, PrimaryButton, SectionLabel } from '@/components/ui';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { employee, session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace('/(auth)/login');
  };

  const initials =
    employee?.avatar_initials ?? (employee ? initialsFor(employee.full_name) : '');

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + layout.screenTop, paddingBottom: layout.tabBarSpace },
      ]}
    >
      <Text style={type.largeTitle}>Profil</Text>

      <Card style={styles.identityCard}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: employee?.avatar_color ?? colors.black },
          ]}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.identityText}>
          <Text style={type.headline}>{employee?.full_name ?? '—'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {employee ? ROLE_LABELS[employee.role] : ''}
            </Text>
          </View>
        </View>
      </Card>

      <View>
        <SectionLabel>Compte</SectionLabel>
        <Card style={styles.groupCard}>
          <ListRow label="E-mail" value={employee?.email ?? session?.user?.email ?? '—'} />
          <ListRow label="Rôle" value={employee ? ROLE_LABELS[employee.role] : '—'} />
          <ListRow
            label="Statut"
            value={employee?.is_active ? 'Actif' : 'Inactif'}
            danger={!employee?.is_active}
            last
          />
        </Card>
      </View>

      <View>
        <SectionLabel>Application</SectionLabel>
        <Card style={styles.groupCard}>
          <ListRow
            label="Notifications"
            chevron
            onPress={() => router.push('/notifications')}
          />
          <ListRow label="Gestion complète" value="Application web" />
          <ListRow label="Version" value="0.1.0" last />
        </Card>
      </View>

      <PrimaryButton
        title="Se déconnecter"
        onPress={onSignOut}
        loading={signingOut}
        variant="danger"
      />

      <Text style={styles.footer}>Supra v OS Mobile</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  container: { paddingHorizontal: spacing.md, gap: spacing.md },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  identityText: { flex: 1, gap: spacing.xs + 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.orangeSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: colors.orange },
  groupCard: { paddingVertical: spacing.xs },
  footer: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
});
