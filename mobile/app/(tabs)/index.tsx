/**
 * Accueil — Apple-dashboard style: greeting + bell, Health-style stat cards,
 * soft critical alerts, quick actions, upcoming deadlines.
 * All numbers come from RLS-scoped queries (role decides server-side).
 */
import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useHomeSummary } from '@/hooks/useHomeSummary';
import { ROLE_LABELS, hasTaskAccess, hasVideoAccess, isAdminOrPM } from '@/lib/roles';
import { formatDateTime } from '@/lib/task-meta';
import { hapticLight } from '@/lib/haptics';
import { Card, ErrorBanner, SectionLabel, Skeleton } from '@/components/ui';
import { cardShadow, colors, layout, radius, spacing, type } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function StatCard({
  label,
  value,
  icon,
  tint = colors.textSecondary,
  onPress,
}: {
  label: string;
  value: number | null;
  icon: IoniconName;
  tint?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress ? () => { hapticLight(); onPress(); } : undefined}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value ?? '—'}`}
      style={({ pressed }) => [styles.statPressable, pressed && !!onPress && { opacity: 0.75 }]}
    >
      <Card style={styles.statCard}>
        <View style={[styles.statIcon, { backgroundColor: `${tint}14` }]}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
        <Text style={styles.statValue}>{value ?? '—'}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Card>
    </Pressable>
  );
}

function AlertRow({
  text,
  tone,
  onPress,
}: {
  text: string;
  tone: 'danger' | 'info';
  onPress: () => void;
}) {
  const tint = tone === 'danger' ? colors.danger : colors.orange;
  const bg = tone === 'danger' ? colors.dangerSoft : colors.orangeSoft;
  return (
    <Pressable
      onPress={() => { hapticLight(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={text}
      style={({ pressed }) => [styles.alertRow, { backgroundColor: bg }, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.alertDot, { backgroundColor: tint }]} />
      <Text style={[styles.alertText, { color: tint }]} numberOfLines={1}>
        {text}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={tint} />
    </Pressable>
  );
}

function QuickAction({
  label,
  icon,
  onPress,
  accent = false,
}: {
  label: string;
  icon: IoniconName;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={() => { hapticLight(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.quickAction,
        accent && styles.quickActionAccent,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={icon} size={16} color={accent ? colors.white : colors.textPrimary} />
      <Text style={[styles.quickActionText, accent && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { employee } = useAuth();
  const role = employee?.role ?? null;
  const { summary, loading, refreshing, error, refresh, reload } = useHomeSummary(role);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const firstName = employee?.full_name?.split(' ')[0] ?? '';
  const unread = summary.unreadNotifications ?? 0;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + layout.screenTop, paddingBottom: layout.tabBarSpace },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
      }
    >
      <View style={styles.headerBlock}>
        <View style={styles.headerRow}>
          <Text style={[type.largeTitle, styles.headerTitle]} numberOfLines={2}>
            Bonjour {firstName}
          </Text>
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={
              unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'
            }
            style={({ pressed }) => [styles.bellButton, pressed && { opacity: 0.7 }]}
            hitSlop={6}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {unread > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        {role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{ROLE_LABELS[role]}</Text>
          </View>
        ) : null}
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {!loading &&
      ((summary.overdue ?? 0) > 0 ||
        (summary.overdueDeliveries ?? 0) > 0 ||
        (summary.shootingsToday ?? 0) > 0) ? (
        <View style={styles.alerts}>
          {(summary.overdue ?? 0) > 0 ? (
            <AlertRow
              tone="danger"
              text={`${summary.overdue} tâche${(summary.overdue ?? 0) > 1 ? 's' : ''} en retard`}
              onPress={() => router.push('/(tabs)/tasks')}
            />
          ) : null}
          {(summary.overdueDeliveries ?? 0) > 0 ? (
            <AlertRow
              tone="danger"
              text={`${summary.overdueDeliveries} livraison${(summary.overdueDeliveries ?? 0) > 1 ? 's' : ''} vidéo en retard`}
              onPress={() => router.push('/(tabs)/videos')}
            />
          ) : null}
          {(summary.shootingsToday ?? 0) > 0 ? (
            <AlertRow
              tone="info"
              text={`${summary.shootingsToday} tournage${(summary.shootingsToday ?? 0) > 1 ? 's' : ''} aujourd’hui`}
              onPress={() => router.push('/(tabs)/calendar')}
            />
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.grid}>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={64} /></Card>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={64} /></Card>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={64} /></Card>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={64} /></Card>
        </View>
      ) : (
        <View style={styles.grid}>
          {hasTaskAccess(role) && (
            <>
              <StatCard
                label="Tâches ouvertes"
                value={summary.openTasks}
                icon="list"
                onPress={() => router.push('/(tabs)/tasks')}
              />
              <StatCard
                label="À rendre aujourd’hui"
                value={summary.dueToday}
                icon="today"
                tint={colors.orange}
                onPress={() => router.push('/(tabs)/calendar')}
              />
              <StatCard
                label="En retard"
                value={summary.overdue}
                icon="alert-circle"
                tint={(summary.overdue ?? 0) > 0 ? colors.danger : colors.textSecondary}
                onPress={() => router.push('/(tabs)/tasks')}
              />
            </>
          )}
          {hasVideoAccess(role) && (
            <StatCard
              label="Vidéos en cours"
              value={summary.activeVideos}
              icon="videocam"
              tint={colors.info}
              onPress={() => router.push('/(tabs)/videos')}
            />
          )}
          {!hasTaskAccess(role) && !hasVideoAccess(role) && (
            <Card style={styles.fullCard}>
              <Text style={type.headline}>Bienvenue sur Supra OS Mobile</Text>
              <Text style={styles.emptyText}>
                Votre rôle n’a pas encore de module mobile dédié. Utilisez
                l’application web pour vos outils.
              </Text>
            </Card>
          )}
        </View>
      )}

      <View style={styles.quickRow}>
        {isAdminOrPM(role) ? (
          <QuickAction
            label="Nouvelle tâche"
            icon="add"
            accent
            onPress={() => router.push('/tasks/new')}
          />
        ) : null}
        {hasTaskAccess(role) ? (
          <QuickAction
            label="Calendrier"
            icon="calendar-outline"
            onPress={() => router.push('/(tabs)/calendar')}
          />
        ) : null}
        <QuickAction
          label="Notifications"
          icon="notifications-outline"
          onPress={() => router.push('/notifications')}
        />
      </View>

      {!loading && summary.upcoming.length > 0 ? (
        <View>
          <SectionLabel>À venir</SectionLabel>
          <Card style={styles.upcomingCard}>
            {summary.upcoming.map((t, i) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/tasks/${t.id}`)}
                accessibilityRole="button"
                accessibilityLabel={t.title}
                style={({ pressed }) => [
                  styles.upcomingRow,
                  i < summary.upcoming.length - 1 && styles.upcomingRowBorder,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <View style={styles.upcomingTexts}>
                  <Text style={styles.upcomingTitle} numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text style={type.caption}>{formatDateTime(t.deadline)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  container: { paddingHorizontal: spacing.md, gap: spacing.md },
  headerBlock: { gap: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // Centré : la cloche s'aligne optiquement sur la ligne du grand titre.
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: { flex: 1 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.orangeSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: colors.orange },
  bellButton: {
    width: layout.touch,
    height: layout.touch,
    borderRadius: layout.touch / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  alerts: { gap: spacing.sm },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: layout.touch + 4,
  },
  alertDot: { width: 7, height: 7, borderRadius: 4 },
  alertText: { flex: 1, fontSize: 14, fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 4,
  },
  statPressable: { flexBasis: '47%', flexGrow: 1 },
  statCard: { minHeight: 108, justifyContent: 'center', gap: 2 },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '500' },
  fullCard: { width: '100%', gap: spacing.xs },
  emptyText: { ...type.body, color: colors.textSecondary },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    minHeight: layout.touch,
    ...cardShadow,
  },
  quickActionAccent: { backgroundColor: colors.orange },
  quickActionText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  upcomingCard: { paddingVertical: spacing.xs },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.touch + 6,
    paddingVertical: spacing.xs,
  },
  upcomingRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  upcomingTexts: { flex: 1, gap: 1 },
  upcomingTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
});
