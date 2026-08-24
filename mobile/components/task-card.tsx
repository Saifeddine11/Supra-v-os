/**
 * Compact task row + shared badges — Reminders/Linear feel:
 * status as a colored dot + quiet label, overdue as a small red date,
 * assignee initials as overlapping chips.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cardShadow, colors, radius, spacing } from '@/constants/theme';
import { PRIORITY_MAP, TASK_STATUS_MAP, formatDeadline, isTaskOverdue } from '@/lib/task-meta';
import type { TaskAssigneeInfo, TaskListItem } from '@/hooks/useTasks';

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}14` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

/** Colored status dot + quiet label (lighter than a full badge). */
export function StatusDot({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.statusDotWrap}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusDotText}>{label}</Text>
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
  const done = task.status === 'done';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}${overdue ? ', en retard' : ''}`}
      style={({ pressed }) => [styles.card, done && { opacity: 0.65 }, pressed && styles.cardPressed]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        <AssigneeChips assignees={task.assignees} />
      </View>

      <View style={styles.metaRow}>
        <StatusDot label={status.label} color={status.color} />
        {task.priority === 'urgent' || task.priority === 'high' ? (
          <Badge label={priority.label} color={priority.color} />
        ) : null}
        {task.client_name ? (
          <Text style={styles.client} numberOfLines={1}>
            {task.client_name}
          </Text>
        ) : null}
        {deadlineLabel ? (
          <View style={styles.deadlineWrap}>
            {overdue ? <View style={styles.overdueDot} /> : null}
            <Text style={[styles.deadline, overdue && styles.deadlineOverdue]}>
              {deadlineLabel}
            </Text>
          </View>
        ) : null}
      </View>
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
  cardPressed: { opacity: 0.75 },
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
  titleDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  client: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '500', flexShrink: 1 },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2.5,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  statusDotWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotText: { fontSize: 12.5, fontWeight: '600', color: colors.textSecondary },
  deadlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
  },
  overdueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  deadline: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  deadlineOverdue: { color: colors.danger, fontWeight: '700' },
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
  chipExtra: { fontSize: 11, color: colors.textSecondary, marginLeft: spacing.xs },
});
