/**
 * Vidéos — RLS-scoped production tracker with kanban-aligned filter chips.
 * Tab hidden for roles without video access (web nav-policy mirror);
 * an in-screen guard covers direct navigation.
 */
import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { VIDEO_FILTERS, useVideos, type VideoFilter } from '@/hooks/useVideos';
import { hasVideoAccess } from '@/lib/roles';
import { VideoCard } from '@/components/video-card';
import { Card, ErrorBanner, FilterChips, Skeleton } from '@/components/ui';
import { colors, layout, spacing, type } from '@/constants/theme';

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
          <Text style={type.headline}>Accès restreint</Text>
          <Text style={styles.guardText}>
            Votre rôle n’a pas accès au module vidéos.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + layout.screenTop }]}>
      <Text style={[type.largeTitle, styles.title]}>Vidéos</Text>

      <View style={styles.filterWrap}>
        <FilterChips options={VIDEO_FILTERS} active={filter} onSelect={setFilter} />
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
          contentContainerStyle={[
            styles.pad,
            { paddingBottom: layout.tabBarSpace, gap: spacing.sm + 2 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
          }
          renderItem={({ item }) => (
            <VideoCard video={item} onPress={() => router.push(`/videos/${item.id}`)} />
          )}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Ionicons name="film-outline" size={28} color={colors.muted} />
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
  title: { paddingHorizontal: spacing.md, marginBottom: spacing.sm + 2 },
  filterWrap: { marginBottom: spacing.sm + 4 },
  pad: { paddingHorizontal: spacing.md },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  guard: { padding: spacing.md },
  guardText: { ...type.body, color: colors.textSecondary, marginTop: spacing.xs },
});
