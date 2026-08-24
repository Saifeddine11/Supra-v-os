/**
 * Month grid (6 Monday-first weeks) + week strip — Apple Calendar feel.
 * Day cells: today ring, selected capsule, up to 3 client-colored event
 * dots then « + ». Client colors are deterministic (lib/client-colors).
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  WEEKDAY_LABELS,
  dayKey,
  monthGridDays,
  sameDay,
  shortDayLabel,
  weekDays,
} from '@/lib/calendar-utils';
import { clientColor } from '@/lib/client-colors';
import { hapticSelection } from '@/lib/haptics';
import { colors, radius, spacing } from '@/constants/theme';
import type { CalendarEvent } from '@/hooks/useCalendarEvents';

const MAX_DOTS = 3;

function dotColors(events: CalendarEvent[] | undefined): string[] {
  if (!events || events.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ev of events) {
    const c = clientColor(ev.clientId, ev.clientName).accent;
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
      if (out.length === MAX_DOTS) break;
    }
  }
  return out;
}

function a11yDayLabel(d: Date, count: number, isToday: boolean): string {
  const parts = [shortDayLabel(d)];
  if (isToday) parts.push('aujourd’hui');
  parts.push(count === 0 ? 'aucun événement' : `${count} événement${count > 1 ? 's' : ''}`);
  return parts.join(', ');
}

function DayCell({
  date,
  inMonth,
  selected,
  today,
  events,
  onSelect,
}: {
  date: Date;
  inMonth: boolean;
  selected: boolean;
  today: boolean;
  events: CalendarEvent[] | undefined;
  onSelect: (d: Date) => void;
}) {
  const dots = dotColors(events);
  const count = events?.length ?? 0;
  const extra = count > MAX_DOTS;

  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onSelect(date);
      }}
      accessibilityRole="button"
      accessibilityLabel={a11yDayLabel(date, count, today)}
      accessibilityState={{ selected }}
      style={styles.cell}
    >
      <View
        style={[
          styles.dayNumberWrap,
          today && !selected && styles.todayRing,
          selected && styles.selectedFill,
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            !inMonth && styles.dayNumberDim,
            today && !selected && styles.dayNumberToday,
            selected && styles.dayNumberSelected,
          ]}
        >
          {date.getDate()}
        </Text>
      </View>
      <View style={styles.dotsRow}>
        {dots.map((c, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: c }]} />
        ))}
        {extra ? <Text style={styles.dotExtra}>+</Text> : null}
      </View>
    </Pressable>
  );
}

export function WeekdayHeader() {
  return (
    <View style={styles.weekdayRow}>
      {WEEKDAY_LABELS.map((l) => (
        <Text key={l} style={styles.weekdayLabel}>
          {l}
        </Text>
      ))}
    </View>
  );
}

export function MonthGrid({
  anchor,
  selected,
  eventsByDay,
  onSelect,
}: {
  anchor: Date;
  selected: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onSelect: (d: Date) => void;
}) {
  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const today = new Date();
  const month = anchor.getMonth();

  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);

  return (
    <View>
      <WeekdayHeader />
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((d) => (
            <DayCell
              key={dayKey(d)}
              date={d}
              inMonth={d.getMonth() === month}
              selected={sameDay(d, selected)}
              today={sameDay(d, today)}
              events={eventsByDay.get(dayKey(d))}
              onSelect={onSelect}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function WeekStrip({
  anchor,
  selected,
  eventsByDay,
  onSelect,
}: {
  anchor: Date;
  selected: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onSelect: (d: Date) => void;
}) {
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const today = new Date();

  return (
    <View>
      <WeekdayHeader />
      <View style={styles.weekRow}>
        {days.map((d) => (
          <DayCell
            key={dayKey(d)}
            date={d}
            inMonth
            selected={sameDay(d, selected)}
            today={sameDay(d, today)}
            events={eventsByDay.get(dayKey(d))}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  weekRow: { flexDirection: 'row' },
  cell: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    paddingTop: 2,
  },
  dayNumberWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayRing: {
    borderWidth: 1.5,
    borderColor: colors.orange,
  },
  selectedFill: { backgroundColor: colors.black },
  dayNumber: { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  dayNumberDim: { color: colors.muted, opacity: 0.55 },
  dayNumberToday: { color: colors.orange, fontWeight: '700' },
  dayNumberSelected: { color: colors.white, fontWeight: '700' },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 8,
    marginTop: 2,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotExtra: { fontSize: 9, color: colors.muted, fontWeight: '700', lineHeight: 9 },
});
