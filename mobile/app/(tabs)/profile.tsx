import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/lib/roles';
import { Card, PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';

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
        { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl },
      ]}
    >
      <Text style={styles.title}>Profil</Text>

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
          <Text style={styles.name}>{employee?.full_name ?? '—'}</Text>
          <Text style={styles.roleBadge}>
            {employee ? ROLE_LABELS[employee.role] : ''}
          </Text>
        </View>
      </Card>

      <Card>
        <Row label="E-mail" value={employee?.email ?? session?.user?.email ?? '—'} />
        <Row label="Rôle" value={employee ? ROLE_LABELS[employee.role] : '—'} />
        <Row
          label="Statut"
          value={employee?.is_active ? 'Actif' : 'Inactif'}
          last
        />
      </Card>

      <PrimaryButton
        title="Notifications"
        onPress={() => router.push('/notifications')}
        variant="ghost"
      />

      <PrimaryButton
        title="Se déconnecter"
        onPress={onSignOut}
        loading={signingOut}
        variant="ghost"
      />

      <Text style={styles.footer}>Supra OS Mobile · v0.1.0</Text>
    </ScrollView>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  container: { paddingHorizontal: spacing.md, gap: spacing.md },
  title: { fontSize: 26, fontWeight: '700', color: colors.black },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  identityText: { flex: 1, gap: spacing.xs },
  name: { fontSize: 18, fontWeight: '700', color: colors.black },
  roleBadge: { fontSize: 13, color: colors.orange, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    gap: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  rowValue: { fontSize: 14, color: colors.black, fontWeight: '600', flexShrink: 1 },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: spacing.sm },
});
