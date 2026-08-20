/**
 * Compact task card + badges shared by the list and detail screens.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import { PRIORITY_MAP, TASK_STATUS_MAP, formatDeadline, isTaskOverdue } from '@/lib/task-meta';
import type { TaskAssigneeInfo, TaskListItem } from '@/hooks/useTasks';

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A`, borderColor: `${color}55` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function initialsOf(assignee: TaskAssigneeInfo): string {
  if (assignee.avatar_initials) return assignee.avatar_initials;
  return assignee.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function AssigneeChips({ assignees, max = 3 }: { assignees: TaskAssigneeInfo[]; max?: number }) {
  if (assignees.length === 0) return null;
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;
  return (
    <View style={styles.chipRow}>
      {shown.map((a) => (
        <View key={a.id} style={[styles.chip, { backgroundColor: a.avatar_color ?? colors.black }]}>
          <Text style={styles.chipText}>{initialsOf(a)}</Text>
        </View>
      ))}
      {extra > 0 ? <Text style={styles.chipExtra}>+{extra}</Text> : null}
    </View>
  );
}

export function TaskCard({ task, onPress }: { task: TaskListItem; onPress: () => void }) {
  const status = TASK_STATUS_MAP[task.status];
  const priority = PRIORITY_MAP[task.priority];
  const overdue = isTaskOverdue(task.deadline, task.status);
  const deadlineLabel = formatDeadline(task.deadline);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>
          {task.title}
        </Text>
        <AssigneeChips assignees={task.assignees} />
      </View>

      {task.client_name ? (
        <Text style={styles.client} numberOfLines={1}>
          {task.client_name}
        </Text>
      ) : null}

      <View style={styles.badgeRow}>
        <Badge label={status.label} color={status.color} />
        {task.priority !== 'normal' ? (
          <Badge label={priority.label} color={priority.color} />
        ) : null}
        {overdue ? <Badge label="En retard" color={colors.danger} /> : null}
        {deadlineLabel ? (
          <Text style={[styles.deadline, overdue && { color: colors.danger, fontWeight: '600' }]}>
            {deadlineLabel}
          </Text>
        ) : null}
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
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  deadline: { fontSize: 12, color: colors.muted, marginLeft: 'auto' },
  chipRow: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  chipText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  chipExtra: { fontSize: 11, color: colors.muted, marginLeft: spacing.xs },
});
