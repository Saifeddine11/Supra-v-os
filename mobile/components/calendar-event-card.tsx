/**
 * Agenda event card + compact overdue row.
 * Visual language: client color (accent bar + soft tint) = who,
 * type icon/color = what (Tâche / Tournage / Livraison),
 * small red markers = urgency — never a full red card.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cardShadow, colors, radius, spacing } from '@/constants/theme';
import { PRIORITY_MAP, TASK_STATUS_MAP, formatDeadline } from '@/lib/task-meta';
import { VIDEO_STATUS_MAP } from '@/lib/video-meta';
import { clientColor } from '@/lib/client-colors';
import { timeLabel } from '@/lib/calendar-utils';
import { AssigneeChips, Badge, StatusDot } from '@/components/task-card';
import { hapticLight } from '@/lib/haptics';
import type { CalendarEvent, CalendarEventKind } from '@/hooks/useCalendarEvents';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const KIND_META: Record<
  CalendarEventKind,
  { label: string; icon: IoniconName; color: string }
> = {
  task: { label: 'Tâche', icon: 'checkmark-circle-outline', color: colors.info },
  shooting: { label: 'Tournage', icon: 'videocam-outline', color: '#4FA3A0' },
  delivery: { label: 'Livraison', icon: 'paper-plane-outline', color: '#C49A4B' },
};

function statusOf(ev: CalendarEvent) {
  if (ev.taskStatus != null) return TASK_STATUS_MAP[ev.taskStatus];
  if (ev.videoStatus != null) return VIDEO_STATUS_MAP[ev.videoStatus];
  return null;
}

export function CalendarEventCard({
  event,
  onPress,
}: {
  event: CalendarEvent;
  onPress: () => void;
}) {
  const kind = KIND_META[event.kind];
  const client = clientColor(event.clientId, event.clientName);
  const status = statusOf(event);
  const priority =
    event.taskPriority === 'urgent' || event.taskPriority === 'high'
      ? PRIORITY_MAP[event.taskPriority]
      : null;
  const time = timeLabel(event.at);

  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${kind.label} : ${event.title}${event.overdue ? ', en retard' : ''}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: event.clientId ? client.soft : colors.surface },
        event.done && { opacity: 0.6 },
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: client.accent }]} />

      <View style={styles.leftCol}>
        <Text style={[styles.time, event.overdue && { color: colors.danger }]}>
          {time ?? 'Journée'}
        </Text>
        <View style={styles.kindRow}>
          <Ionicons name={kind.icon} size={13} color={kind.color} />
          <Text style={[styles.kindLabel, { color: kind.color }]}>{kind.label}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, event.done && styles.titleDone]} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.metaRow}>
          {event.clientName ? (
            <Text style={[styles.client, { color: client.text }]} numberOfLines={1}>
              {event.clientName}
            </Text>
          ) : null}
          {status ? <StatusDot label={status.label} color={status.color} /> : null}
          {priority ? <Badge label={priority.label} color={priority.color} /> : null}
          {event.overdue ? <Badge label="En retard" color={colors.danger} /> : null}
        </View>
      </View>

      <View style={styles.rightCol}>
        <AssigneeChips assignees={event.assignees} max={2} />
        <Ionicons name="chevron-forward" size={15} color={colors.muted} />
      </View>
    </Pressable>
  );
}

/** Compact « En retard » row — soft red markers only. */
export function OverdueEventRow({
  event,
  last = false,
  onPress,
}: {
  event: CalendarEvent;
  last?: boolean;
  onPress: () => void;
}) {
  const kind = KIND_META[event.kind];
  const client = clientColor(event.clientId, event.clientName);
  const dateLabel = formatDeadline(event.at);

  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${kind.label} en retard : ${event.title}, ${dateLabel ?? ''}`}
      style={({ pressed }) => [
        styles.overdueRow,
        !last && styles.overdueRowBorder,
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={styles.overdueDot} />
      <Ionicons name={kind.icon} size={14} color={colors.textSecondary} />
      <View style={styles.overdueBody}>
        <Text style={styles.overdueTitle} numberOfLines={1}>
          {event.title}
        </Text>
        {event.clientName ? (
          <Text style={[styles.overdueClient, { color: client.text }]} numberOfLines={1}>
            {event.clientName}
          </Text>
        ) : null}
      </View>
      <Text style={styles.overdueDate}>{dateLabel}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingRight: spacing.sm + 4,
    paddingLeft: spacing.sm + 2,
    ...cardShadow,
  },
  accentBar: { width: 3.5, alignSelf: 'stretch', borderRadius: 2 },
  leftCol: { width: 66, gap: 3 },
  time: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  kindLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  body: { flex: 1, gap: spacing.xs },
  title: { fontSize: 14.5, fontWeight: '600', color: colors.textPrimary, lineHeight: 19 },
  titleDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  client: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  rightCol: { alignItems: 'flex-end', gap: spacing.xs },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 46,
    paddingVertical: spacing.xs,
  },
  overdueRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  overdueDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  overdueBody: { flex: 1, gap: 1 },
  overdueTitle: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  overdueClient: { fontSize: 11.5, fontWeight: '600' },
  overdueDate: { fontSize: 12, fontWeight: '700', color: colors.danger },
});
