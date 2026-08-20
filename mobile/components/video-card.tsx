/**
 * Compact video card — status, dates, team, overdue delivery.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDateTime } from '@/lib/task-meta';
import {
  VIDEO_FORMAT_LABELS,
  VIDEO_STATUS_MAP,
  effectiveClientDeliveryIso,
  isVideoDeliveryOverdue,
} from '@/lib/video-meta';
import { AssigneeChips, Badge } from '@/components/task-card';
import type { VideoListItem } from '@/hooks/useVideos';

export function VideoCard({ video, onPress }: { video: VideoListItem; onPress: () => void }) {
  const status = VIDEO_STATUS_MAP[video.status];
  const overdue = isVideoDeliveryOverdue(video);
  const shooting = formatDateTime(video.shooting_date);
  const delivery = formatDateTime(effectiveClientDeliveryIso(video));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <AssigneeChips assignees={video.team} />
      </View>

      {video.client_name ? (
        <Text style={styles.client} numberOfLines={1}>
          {video.client_name}
        </Text>
      ) : null}

      <View style={styles.badgeRow}>
        <Badge label={status.label} color={status.color} />
        {video.format ? (
          <Badge label={VIDEO_FORMAT_LABELS[video.format]} color={colors.muted} />
        ) : null}
        {overdue ? <Badge label="Livraison en retard" color={colors.danger} /> : null}
      </View>

      {shooting || delivery ? (
        <View style={styles.dateRow}>
          {shooting ? (
            <Text style={styles.dateText}>
              <Text style={styles.dateLabel}>Tournage </Text>
              {shooting}
            </Text>
          ) : null}
          {delivery ? (
            <Text style={[styles.dateText, overdue && { color: colors.danger }]}>
              <Text style={styles.dateLabel}>Livraison </Text>
              {delivery}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs + 2,
  },
  cardPressed: { opacity: 0.8 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.black, lineHeight: 20 },
  client: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  dateRow: { gap: 2, marginTop: spacing.xs },
  dateText: { fontSize: 12, color: colors.black, fontWeight: '600' },
  dateLabel: { color: colors.muted, fontWeight: '500' },
});
