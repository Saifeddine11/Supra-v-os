/**
 * Accueil — role-aware summary. Counts come from RLS-scoped queries:
 * each role only ever sees what the server allows.
 */
import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useHomeSummary } from '@/hooks/useHomeSummary';
import { ROLE_LABELS, hasTaskAccess, hasVideoAccess, isAdminOrPM } from '@/lib/roles';
import { Card, ErrorBanner, Skeleton } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';

function StatCard({
  label,
  value,
  accent = false,
  onPress,
}: {
  label: string;
  value: number | null;
  accent?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.statPressable, pressed && !!onPress && { opacity: 0.75 }]}
    >
      <Card style={styles.statCard}>
        <Text style={[styles.statValue, accent && { color: colors.orange }]}>
          {value ?? '—'}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Card>
    </Pressable>
  );
}

function AlertCard({
  text,
  tone,
  onPress,
}: {
  text: string;
  tone: 'danger' | 'info';
  onPress: () => void;
}) {
  const danger = tone === 'danger';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.alertCard,
        danger ? styles.alertDanger : styles.alertInfo,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.alertText, { color: danger ? colors.danger : colors.orange }]}>
        {text}
      </Text>
      <Text style={[styles.alertChevron, { color: danger ? colors.danger : colors.orange }]}>
        ›
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { employee } = useAuth();
  const role = employee?.role ?? null;
  const { summary, loading, refreshing, error, refresh, reload } = useHomeSummary(role);

  // Silent re-sync (badge, alerts) when returning to the tab.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const firstName = employee?.full_name?.split(' ')[0] ?? '';
  const scopeHint = isAdminOrPM(role)
    ? 'Vue équipe complète'
    : 'Vos éléments assignés';

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
      }
    >
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Text style={styles.hello}>Bonjour {firstName}</Text>
          <Text style={styles.role}>
            {role ? ROLE_LABELS[role] : ''} · {scopeHint}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/notifications')}
          style={({ pressed }) => [styles.bellButton, pressed && { opacity: 0.7 }]}
          hitSlop={6}
        >
          <Text style={styles.bellGlyph}>🔔</Text>
          {(summary.unreadNotifications ?? 0) > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {(summary.unreadNotifications ?? 0) > 99 ? '99+' : summary.unreadNotifications}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {!loading ? (
        <View style={styles.alerts}>
          {(summary.overdue ?? 0) > 0 ? (
            <AlertCard
              tone="danger"
              text={`${summary.overdue} tâche${(summary.overdue ?? 0) > 1 ? 's' : ''} en retard`}
              onPress={() => router.push('/(tabs)/tasks')}
            />
          ) : null}
          {(summary.overdueDeliveries ?? 0) > 0 ? (
            <AlertCard
              tone="danger"
              text={`${summary.overdueDeliveries} livraison${(summary.overdueDeliveries ?? 0) > 1 ? 's' : ''} vidéo en retard`}
              onPress={() => router.push('/(tabs)/videos')}
            />
          ) : null}
          {(summary.shootingsToday ?? 0) > 0 ? (
            <AlertCard
              tone="info"
              text={`${summary.shootingsToday} tournage${(summary.shootingsToday ?? 0) > 1 ? 's' : ''} aujourd’hui`}
              onPress={() => router.push('/(tabs)/calendar')}
            />
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.grid}>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={56} /></Card>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={56} /></Card>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={56} /></Card>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={56} /></Card>
        </View>
      ) : (
        <View style={styles.grid}>
          {hasTaskAccess(role) && (
            <>
              <StatCard
                label="Tâches ouvertes"
                value={summary.openTasks}
                onPress={() => router.push('/(tabs)/tasks')}
              />
              <StatCard
                label="À rendre aujourd’hui"
                value={summary.dueToday}
                accent
                onPress={() => router.push('/(tabs)/calendar')}
              />
              <StatCard
                label="En retard"
                value={summary.overdue}
                accent={(summary.overdue ?? 0) > 0}
                onPress={() => router.push('/(tabs)/tasks')}
              />
            </>
          )}
          {hasVideoAccess(role) && (
            <StatCard
              label="Vidéos en cours"
              value={summary.activeVideos}
              onPress={() => router.push('/(tabs)/videos')}
            />
          )}
          {!hasTaskAccess(role) && !hasVideoAccess(role) && (
            <Card style={styles.fullCard}>
              <Text style={styles.emptyTitle}>Bienvenue sur Supra OS Mobile</Text>
              <Text style={styles.emptyText}>
                Votre rôle n’a pas encore de module mobile dédié. Les tâches et
                vidéos arrivent pour les rôles opérationnels ; utilisez
                l’application web pour le reste.
              </Text>
            </Card>
          )}
        </View>
      )}

      <Card style={styles.fullCard}>
        <Text style={styles.noticeTitle}>Supra v OS — version mobile (bêta)</Text>
        <Text style={styles.noticeText}>
          Tâches, calendrier et vidéos en consultation et suivi. La gestion
          complète (création, finance, SupAI) reste sur l’application web.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  container: { paddingHorizontal: spacing.md, gap: spacing.md },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  header: { gap: spacing.xs, marginBottom: spacing.xs, flex: 1 },
  bellButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellGlyph: { fontSize: 20 },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  alerts: { gap: spacing.sm },
  alertCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 50,
    gap: spacing.sm,
  },
  alertDanger: { backgroundColor: '#FBEAEA', borderColor: '#EFB9B9' },
  alertInfo: { backgroundColor: '#FFF1EA', borderColor: '#F6C9B4' },
  alertText: { fontSize: 14, fontWeight: '700', flex: 1 },
  alertChevron: { fontSize: 20, fontWeight: '700' },
  hello: { fontSize: 26, fontWeight: '700', color: colors.black },
  role: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 4,
  },
  statPressable: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  statCard: {
    minHeight: 96,
    justifyContent: 'center',
  },
  statValue: { fontSize: 32, fontWeight: '800', color: colors.black },
  statLabel: { fontSize: 13, color: colors.muted, marginTop: spacing.xs, fontWeight: '500' },
  fullCard: { width: '100%' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.black },
  emptyText: { fontSize: 14, color: colors.muted, marginTop: spacing.xs, lineHeight: 20 },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: colors.orange },
  noticeText: { fontSize: 13, color: colors.muted, marginTop: spacing.xs, lineHeight: 19 },
});
