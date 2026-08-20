/**
 * Vidéos — RLS-scoped video list with kanban-aligned filter chips.
 * Tab hidden for roles without video access (web nav-policy mirror);
 * an in-screen guard covers direct navigation.
 */
import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { VIDEO_FILTERS, useVideos, type VideoFilter } from '@/hooks/useVideos';
import { hasVideoAccess } from '@/lib/roles';
import { VideoCard } from '@/components/video-card';
import { Card, ErrorBanner, Skeleton } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';

const EMPTY_LABELS: Record<VideoFilter, string> = {
  all: 'Aucune vidéo visible pour le moment.',
  preparation: 'Aucune vidéo en préparation.',
  shooting: 'Aucun tournage en cours ou planifié.',
  editing: 'Aucune vidéo en montage.',
  review: 'Aucune vidéo en révision.',
  waiting_client: 'Aucune vidéo en attente client.',
  delivered: 'Aucune vidéo livrée.',
};

export default function VideosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { employee } = useAuth();
  const role = employee?.role ?? null;
  const [filter, setFilter] = useState<VideoFilter>('all');
  const { videos, loading, refreshing, error, refresh } = useVideos(filter);

  if (!hasVideoAccess(role)) {
    return (
      <View style={[styles.flex, styles.guard, { paddingTop: insets.top + spacing.xl }]}>
        <Card>
          <Text style={styles.guardTitle}>Accès restreint</Text>
          <Text style={styles.guardText}>
            Votre rôle n’a pas accès au module vidéos.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>Vidéos</Text>

      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {VIDEO_FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.pad}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.pad, { gap: spacing.sm + 4 }]}>
          <Card><Skeleton height={80} /></Card>
          <Card><Skeleton height={80} /></Card>
          <Card><Skeleton height={80} /></Card>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          contentContainerStyle={[styles.pad, { paddingBottom: spacing.xl, gap: spacing.sm + 4 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
          }
          renderItem={({ item }) => (
            <VideoCard video={item} onPress={() => router.push(`/videos/${item.id}`)} />
          )}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>{EMPTY_LABELS[filter]}</Text>
            </Card>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.black,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  filterWrap: { marginBottom: spacing.sm + 4 },
  filterRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    minHeight: 38,
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: colors.black, borderColor: colors.black },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.black },
  filterTextActive: { color: colors.white },
  pad: { paddingHorizontal: spacing.md },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  guard: { padding: spacing.md },
  guardTitle: { fontSize: 16, fontWeight: '700', color: colors.black },
  guardText: { fontSize: 14, color: colors.muted, marginTop: spacing.xs, lineHeight: 20 },
});
