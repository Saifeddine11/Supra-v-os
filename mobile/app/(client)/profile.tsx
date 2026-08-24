/**
 * Profil client — informations d'identité et déconnexion.
 * Aucun identifiant technique, aucune donnée employé, aucun réglage admin.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useClientWorkspace } from '@/hooks/useClientWorkspace';
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

export default function ClientProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clientUser, signOut } = useAuth();
  const { data } = useClientWorkspace();
  const [signingOut, setSigningOut] = useState(false);

  const identity = data.client ?? clientUser;
  const fullName = identity?.full_name ?? '';
  const clientName = identity?.name ?? '';

  const onSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace('/(auth)/login');
  };

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
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsFor(fullName || clientName || '?')}</Text>
        </View>
        <View style={styles.identityText}>
          <Text style={type.headline}>{fullName || '—'}</Text>
          {clientName ? (
            <View style={styles.clientBadge}>
              <Text style={styles.clientBadgeText}>{clientName}</Text>
            </View>
          ) : null}
        </View>
      </Card>

      <View>
        <SectionLabel>Compte</SectionLabel>
        <Card style={styles.groupCard}>
          <ListRow label="Nom" value={fullName || '—'} />
          <ListRow label="E-mail" value={identity?.email ?? '—'} />
          <ListRow label="Client" value={clientName || '—'} />
          <ListRow label="Statut" value="Actif" last />
        </Card>
      </View>

      <PrimaryButton
        title="Se déconnecter"
        onPress={onSignOut}
        loading={signingOut}
        variant="danger"
      />

      <Text style={styles.footer}>Supra v OS · Espace client</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  container: { paddingHorizontal: spacing.md, gap: spacing.md },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  identityText: { flex: 1, gap: spacing.xs + 2 },
  clientBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.orangeSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  clientBadgeText: { fontSize: 12, fontWeight: '700', color: colors.orange },
  groupCard: { paddingVertical: spacing.xs },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: spacing.sm },
});
