/**
 * Vidéos du client — lecture seule (portal_my_videos).
 *
 * Le statut interne n'est jamais exposé : la RPC ne renvoie que
 * `public_status`. Les URLs média ne sont présentes que lorsque le serveur
 * les autorise (validation/publication) — aucune décision côté mobile.
 * Phase 1 : pas de validation, pas de demande de modification, pas de commentaire.
 */
import React from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  effectiveDeliveryIso,
  useClientWorkspace,
  type ClientVideo,
} from '@/hooks/useClientWorkspace';
import { isAwaitingClientValidation, videoPublicStatusBadge } from '@/lib/client-labels';
import { formatDateTime } from '@/lib/task-meta';
import { Badge } from '@/components/task-card';
import { Card, ErrorBanner, Skeleton } from '@/components/ui';
import { cardShadow, colors, layout, radius, spacing, type } from '@/constants/theme';

function DateCell({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.dateCol}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Text style={styles.dateValue}>{value ?? '—'}</Text>
    </View>
  );
}

function VideoCard({ video }: { video: ClientVideo }) {
  const badge = videoPublicStatusBadge(video.public_status);
  const awaiting = isAwaitingClientValidation(video.public_status);
  const mediaUrl = video.final_url ?? video.preview_url;

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {video.title}
      </Text>

      <View style={styles.metaRow}>
        <Badge label={badge.label} color={badge.color} />
        {awaiting ? <Badge label="Votre validation attendue" color={colors.orange} /> : null}
      </View>

      <View style={styles.dateGrid}>
        <DateCell label="Tournage" value={formatDateTime(video.shooting_date)} />
        <View style={styles.dateSeparator} />
        <DateCell label="Livraison" value={formatDateTime(effectiveDeliveryIso(video))} />
        <View style={styles.dateSeparator} />
        <DateCell label="Publication" value={formatDateTime(video.publication_date)} />
      </View>

      {mediaUrl ? (
        <Pressable
          onPress={() => {
            void Linking.openURL(mediaUrl).catch(() => {});
          }}
          accessibilityRole="link"
          accessibilityLabel={`Ouvrir la vidéo ${video.title}`}
          style={({ pressed }) => [styles.mediaButton, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="play-circle-outline" size={17} color={colors.orange} />
          <Text style={styles.mediaText}>Voir la vidéo</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export default function ClientVideosScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, refreshing, error, refresh } = useClientWorkspace();

  return (
    <View style={[styles.flex, { paddingTop: insets.top + layout.screenTop }]}>
      <Text style={[type.largeTitle, styles.title]}>Vidéos</Text>

      {error ? (
        <View style={styles.pad}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.pad, { gap: spacing.sm + 4 }]}>
          <Card><Skeleton height={100} /></Card>
          <Card><Skeleton height={100} /></Card>
        </View>
      ) : (
        <FlatList
          data={data.videos}
          keyExtractor={(v) => v.id}
          contentContainerStyle={[
            styles.pad,
            { paddingBottom: layout.tabBarSpace, gap: spacing.sm + 2 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
          }
          renderItem={({ item }) => <VideoCard video={item} />}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Ionicons name="film-outline" size={28} color={colors.muted} />
              <Text style={styles.emptyText}>Aucune vidéo pour le moment.</Text>
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
  pad: { paddingHorizontal: spacing.md },
  card: { gap: spacing.sm },
  cardTitle: { fontSize: 15.5, fontWeight: '600', color: colors.textPrimary, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  dateGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.offWhite,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    gap: spacing.sm,
  },
  dateCol: { flex: 1, gap: 1 },
  dateSeparator: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.separator,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dateValue: { fontSize: 12.5, fontWeight: '600', color: colors.textPrimary },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    minHeight: layout.touch,
    borderRadius: radius.sm,
    backgroundColor: colors.orangeSoft,
    ...cardShadow,
  },
  mediaText: { fontSize: 14, fontWeight: '700', color: colors.orange },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
