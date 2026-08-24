/**
 * Notification center — own notifications only (RLS notifications_select_own
 * + explicit recipient filter). iOS Notification-Center feel: grouped by day,
 * type icon, unread dot. Tapping marks read and deep-links task/video.
 */
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import {
  notificationRoute,
  useNotifications,
  type NotificationItem,
} from '@/hooks/useNotifications';
import { notificationTypeLabel, timeAgo } from '@/lib/notification-meta';
import { hasTaskAccess, hasVideoAccess } from '@/lib/roles';
import { hapticLight } from '@/lib/haptics';
import { Card, ErrorBanner, Skeleton } from '@/components/ui';
import { cardShadow, colors, radius, spacing, type } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function typeIcon(t: string): IoniconName {
  if (t.startsWith('task')) return 'checkmark-circle-outline';
  if (t.startsWith('invoice') || t.startsWith('quote')) return 'document-text-outline';
  if (t === 'comment_added') return 'chatbubble-outline';
  if (t === 'document_uploaded') return 'attach-outline';
  if (t === 'client_validated' || t === 'client_revision_requested') return 'videocam-outline';
  if (t === 'morning_summary' || t === 'evening_summary') return 'sunny-outline';
  if (t === 'critical_alert_reminder') return 'alert-circle-outline';
  if (t === 'deadline_soon') return 'time-outline';
  return 'notifications-outline';
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return 'Aujourd’hui';
  if (sameDay(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

interface Section {
  title: string;
  data: NotificationItem[];
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, employee } = useAuth();
  const role = employee?.role ?? null;
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const [markingAll, setMarkingAll] = useState(false);

  const sections = useMemo<Section[]>(() => {
    const byDay = new Map<string, NotificationItem[]>();
    for (const n of notifications) {
      const label = dayLabel(n.created_at);
      const bucket = byDay.get(label);
      if (bucket) bucket.push(n);
      else byDay.set(label, [n]);
    }
    return [...byDay.entries()].map(([title, data]) => ({ title, data }));
  }, [notifications]);

  if (!session || !employee) {
    return <Redirect href="/(auth)/login" />;
  }

  const canOpen = (n: NotificationItem): string | null => {
    const route = notificationRoute(n);
    if (!route) return null;
    if (n.related_entity_type === 'task' && !hasTaskAccess(role)) return null;
    if (n.related_entity_type === 'video' && !hasVideoAccess(role)) return null;
    return route;
  };

  const onPressItem = (n: NotificationItem) => {
    if (!n.is_read) {
      hapticLight();
      void markAsRead(n.id);
    }
    const route = canOpen(n);
    if (route) router.push(route);
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={colors.orange} />
          <Text style={styles.backText}>Accueil</Text>
        </Pressable>
        {unreadCount > 0 ? (
          <Pressable
            onPress={async () => {
              setMarkingAll(true);
              hapticLight();
              await markAllAsRead();
              setMarkingAll(false);
            }}
            disabled={markingAll}
            accessibilityRole="button"
            accessibilityLabel="Tout marquer comme lu"
            hitSlop={8}
            style={styles.markAll}
          >
            <Text style={styles.markAllText}>Tout marquer comme lu</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[type.largeTitle, styles.title]}>
        Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
      </Text>

      {error ? (
        <View style={styles.pad}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.pad, { gap: spacing.sm + 4 }]}>
          <Card><Skeleton height={52} /></Card>
          <Card><Skeleton height={52} /></Card>
          <Card><Skeleton height={52} /></Card>
          <Card><Skeleton height={52} /></Card>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          contentContainerStyle={[styles.pad, { paddingBottom: spacing.xl, gap: spacing.sm }]}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const navigable = canOpen(item) != null;
            return (
              <Pressable
                onPress={() => onPressItem(item)}
                accessibilityRole="button"
                accessibilityLabel={`${notificationTypeLabel(item.type)} : ${item.title}${item.is_read ? '' : ', non lue'}`}
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
              >
                <View style={[styles.iconWrap, !item.is_read && styles.iconWrapUnread]}>
                  <Ionicons
                    name={typeIcon(item.type)}
                    size={17}
                    color={item.is_read ? colors.textSecondary : colors.orange}
                  />
                </View>
                <View style={styles.itemBody}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemType}>{notificationTypeLabel(item.type)}</Text>
                    <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
                  </View>
                  <Text
                    style={[styles.itemTitle, item.is_read && styles.itemTitleRead]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  {item.message ? (
                    <Text style={styles.itemMessage} numberOfLines={2}>
                      {item.message}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.itemRight}>
                  {!item.is_read ? <View style={styles.unreadDot} /> : null}
                  {navigable ? (
                    <Ionicons name="chevron-forward" size={15} color={colors.muted} />
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Ionicons name="notifications-off-outline" size={28} color={colors.muted} />
              <Text style={styles.emptyText}>Aucune notification pour le moment.</Text>
            </Card>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: { fontSize: 16, fontWeight: '600', color: colors.orange },
  markAll: { minHeight: 44, justifyContent: 'center' },
  markAllText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  title: { paddingHorizontal: spacing.md, marginBottom: spacing.sm + 4 },
  pad: { paddingHorizontal: spacing.md },
  sectionHeader: { ...type.sectionHeader, marginTop: spacing.sm },
  item: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'flex-start',
    ...cardShadow,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  iconWrapUnread: { backgroundColor: colors.orangeSoft },
  itemBody: { flex: 1, gap: 2 },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemType: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  itemTime: { fontSize: 11, color: colors.muted },
  itemTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, lineHeight: 19 },
  itemTitleRead: { fontWeight: '500' },
  itemMessage: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  itemRight: { alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
