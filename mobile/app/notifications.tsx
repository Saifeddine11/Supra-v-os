/**
 * Notification center — own notifications only (RLS notifications_select_own).
 * Tapping a task/video notification marks it read and opens the detail.
 */
import React from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import {
  notificationRoute,
  useNotifications,
  type NotificationItem,
} from '@/hooks/useNotifications';
import {
  notificationTypeLabel,
  priorityColor,
  timeAgo,
  type NotificationPriority,
} from '@/lib/notification-meta';
import { hasTaskAccess, hasVideoAccess } from '@/lib/roles';
import { Card, ErrorBanner, Skeleton } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';

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

  if (!session || !employee) {
    return <Redirect href="/(auth)/login" />;
  }

  const canOpen = (n: NotificationItem): string | null => {
    const route = notificationRoute(n);
    if (!route) return null;
    // Respect role gating for the target screen (RLS still decides server-side).
    if (n.related_entity_type === 'task' && !hasTaskAccess(role)) return null;
    if (n.related_entity_type === 'video' && !hasVideoAccess(role)) return null;
    return route;
  };

  const onPressItem = (n: NotificationItem) => {
    if (!n.is_read) void markAsRead(n.id);
    const route = canOpen(n);
    if (route) router.push(route);
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={styles.backButton}
          hitSlop={8}
        >
          <Text style={styles.backText}>‹ Accueil</Text>
        </Pressable>
        {unreadCount > 0 ? (
          <Pressable onPress={() => void markAllAsRead()} hitSlop={8} style={styles.markAll}>
            <Text style={styles.markAllText}>Tout marquer comme lu</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.title}>
        Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
      </Text>

      {error ? (
        <View style={styles.pad}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.pad, { gap: spacing.sm + 4 }]}>
          <Card><Skeleton height={56} /></Card>
          <Card><Skeleton height={56} /></Card>
          <Card><Skeleton height={56} /></Card>
          <Card><Skeleton height={56} /></Card>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={[styles.pad, { paddingBottom: spacing.xl, gap: spacing.sm }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
          }
          renderItem={({ item }) => {
            const navigable = canOpen(item) != null;
            return (
              <Pressable
                onPress={() => onPressItem(item)}
                style={({ pressed }) => [
                  styles.item,
                  !item.is_read && styles.itemUnread,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: item.is_read
                        ? 'transparent'
                        : priorityColor(item.priority as NotificationPriority),
                    },
                  ]}
                />
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
                  {navigable ? <Text style={styles.itemLink}>Ouvrir ›</Text> : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
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
  backButton: { minHeight: 44, justifyContent: 'center' },
  backText: { fontSize: 16, fontWeight: '600', color: colors.orange },
  markAll: { minHeight: 44, justifyContent: 'center' },
  markAllText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.black,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm + 4,
  },
  pad: { paddingHorizontal: spacing.md },
  item: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  itemUnread: { borderColor: '#F3C9BC', backgroundColor: '#FFFDFB' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
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
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  itemTime: { fontSize: 11, color: colors.muted },
  itemTitle: { fontSize: 14, fontWeight: '700', color: colors.black, lineHeight: 19 },
  itemTitleRead: { fontWeight: '500' },
  itemMessage: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  itemLink: { fontSize: 13, color: colors.orange, fontWeight: '600', marginTop: 2 },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center' },
});
