/**
 * Compact calendar item card — Tâche / Tournage / Livraison.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import { PRIORITY_MAP, TASK_STATUS_MAP, formatDateTime } from '@/lib/task-meta';
import { VIDEO_STATUS_MAP } from '@/lib/video-meta';
import { AssigneeChips, Badge } from '@/components/task-card';
import type { CalendarItem, CalendarItemKind } from '@/hooks/useCalendarWork';

const KIND_META: Record<CalendarItemKind, { label: string; color: string }> = {
  task: { label: 'Tâche', color: '#7C8DB0' },
  shooting: { label: 'Tournage', color: colors.orangeGlow },
  delivery: { label: 'Livraison', color: '#6B9E7A' },
};

export function CalendarWorkCard({
  item,
  onPress,
}: {
  item: CalendarItem;
  onPress?: () => void;
}) {
  const kind = KIND_META[item.kind];
  const statusBadge =
    item.taskStatus != null
      ? TASK_STATUS_MAP[item.taskStatus]
      : item.videoStatus != null
        ? VIDEO_STATUS_MAP[item.videoStatus]
        : null;
  const priorityBadge =
    item.taskPriority && item.taskPriority !== 'normal'
      ? PRIORITY_MAP[item.taskPriority]
      : null;
  const when = formatDateTime(item.at);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        item.done && styles.cardDone,
        pressed && !!onPress && styles.cardPressed,
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.kindTag, { backgroundColor: `${kind.color}1A`, borderColor: `${kind.color}66` }]}>
          <Text style={[styles.kindText, { color: kind.color }]}>{kind.label}</Text>
        </View>
        {when ? (
          <Text style={[styles.when, item.overdue && styles.whenOverdue]}>{when}</Text>
        ) : null}
      </View>

      <Text style={[styles.title, item.done && styles.titleDone]} numberOfLines={2}>
        {item.title}
      </Text>
      {item.clientName ? (
        <Text style={styles.client} numberOfLines={1}>
          {item.clientName}
        </Text>
      ) : null}

      <View style={styles.badgeRow}>
        {statusBadge ? <Badge label={statusBadge.label} color={statusBadge.color} /> : null}
        {priorityBadge ? <Badge label={priorityBadge.label} color={priorityBadge.color} /> : null}
        {item.overdue ? <Badge label="En retard" color={colors.danger} /> : null}
        <View style={styles.chips}>
          <AssigneeChips assignees={item.assignees} />
        </View>
      </View>
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
  cardDone: { opacity: 0.6 },
  cardPressed: { opacity: 0.8 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kindTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  kindText: { fontSize: 11, fontWeight: '700' },
  when: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  whenOverdue: { color: colors.danger },
  title: { fontSize: 15, fontWeight: '600', color: colors.black, lineHeight: 20 },
  titleDone: { textDecorationLine: 'line-through', color: colors.muted },
  client: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  chips: { marginLeft: 'auto' },
});
