/**
 * Video card — production-tracker feel: status dot, two-column
 * Tournage / Livraison dates, team chips, soft overdue marker.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cardShadow, colors, radius, spacing } from '@/constants/theme';
import { formatDateTime } from '@/lib/task-meta';
import {
  VIDEO_FORMAT_LABELS,
  VIDEO_STATUS_MAP,
  effectiveClientDeliveryIso,
  isVideoDeliveryOverdue,
} from '@/lib/video-meta';
import { AssigneeChips, Badge, StatusDot } from '@/components/task-card';
import type { VideoListItem } from '@/hooks/useVideos';

export function VideoCard({ video, onPress }: { video: VideoListItem; onPress: () => void }) {
  const status = VIDEO_STATUS_MAP[video.status];
  const overdue = isVideoDeliveryOverdue(video);
  const shooting = formatDateTime(video.shooting_date);
  const delivery = formatDateTime(effectiveClientDeliveryIso(video));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${video.title}${overdue ? ', livraison en retard' : ''}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <AssigneeChips assignees={video.team} />
      </View>

      <View style={styles.metaRow}>
        <StatusDot label={status.label} color={status.color} />
        {video.format ? (
          <Badge label={VIDEO_FORMAT_LABELS[video.format]} color={colors.textSecondary} />
        ) : null}
        {overdue ? <Badge label="Livraison en retard" color={colors.danger} /> : null}
        {video.client_name ? (
          <Text style={styles.client} numberOfLines={1}>
            {video.client_name}
          </Text>
        ) : null}
      </View>

      {shooting || delivery ? (
        <View style={styles.dateGrid}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Tournage</Text>
            <Text style={styles.dateValue}>{shooting ?? '—'}</Text>
          </View>
          <View style={styles.dateSeparator} />
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Livraison</Text>
            <Text style={[styles.dateValue, overdue && { color: colors.danger }]}>
              {delivery ?? '—'}
            </Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...cardShadow,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  client: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '500', flexShrink: 1 },
  dateGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.offWhite,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  dateCol: { flex: 1, gap: 1 },
  dateSeparator: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.separator,
  },
  dateLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dateValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
});
