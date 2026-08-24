/**
 * Calendrier — real calendar experience: month grid / week strip / day
 * agenda, deterministic client colors, RLS-scoped events (task deadlines +
 * video shootings/deliveries), compact « En retard » section.
 * Data is fetched per visible range; selecting a day inside a loaded
 * month/week only re-groups in memory.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useCalendarEvents, type CalendarEvent } from '@/hooks/useCalendarEvents';
import { hasTaskAccess } from '@/lib/roles';
import {
  addDays,
  addMonths,
  dayKey,
  fullDayLabel,
  monthGridDays,
  monthLabel,
  mondayOfWeek,
  sameDay,
  shortDayLabel,
  startOfDay,
} from '@/lib/calendar-utils';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { MonthGrid, WeekStrip } from '@/components/calendar-month-grid';
import { CalendarEventCard, OverdueEventRow } from '@/components/calendar-event-card';
import {
  CalendarViewSwitcher,
  type CalendarViewMode,
} from '@/components/calendar-view-switcher';
import { Card, ErrorBanner, SectionLabel, Skeleton } from '@/components/ui';
import { cardShadow, colors, layout, radius, spacing, type } from '@/constants/theme';

function rangeFor(mode: CalendarViewMode, selected: Date): { start: Date; end: Date } {
  if (mode === 'month') {
    const days = monthGridDays(selected);
    return { start: days[0], end: addDays(days[days.length - 1], 1) };
  }
  if (mode === 'week') {
    const monday = mondayOfWeek(selected);
    return { start: monday, end: addDays(monday, 7) };
  }
  const day = startOfDay(selected);
  return { start: day, end: addDays(day, 1) };
}

function periodLabel(mode: CalendarViewMode, selected: Date): string {
  if (mode === 'month') return monthLabel(selected);
  if (mode === 'week') {
    const monday = mondayOfWeek(selected);
    return `${shortDayLabel(monday)} – ${shortDayLabel(addDays(monday, 6))}`;
  }
  return fullDayLabel(selected);
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { employee } = useAuth();
  const role = employee?.role ?? null;

  const [mode, setMode] = useState<CalendarViewMode>('month');
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));

  const range = useMemo(() => rangeFor(mode, selected), [mode, selected]);
  const { data, loading, refreshing, error, refresh } = useCalendarEvents(range, role);

  const dayEvents = useMemo(
    () => data.eventsByDay.get(dayKey(selected)) ?? [],
    [data.eventsByDay, selected],
  );
  const isToday = sameDay(selected, new Date());

  const openEvent = (ev: CalendarEvent) => {
    if (ev.kind === 'task') router.push(`/tasks/${ev.entityId}`);
    else router.push(`/videos/${ev.entityId}`);
  };

  const navigate = (dir: -1 | 1) => {
    hapticSelection();
    setSelected((prev) => {
      if (mode === 'month') return addMonths(prev, dir);
      if (mode === 'week') return addDays(prev, dir * 7);
      return addDays(prev, dir);
    });
  };

  const goToday = () => {
    hapticLight();
    setSelected(startOfDay(new Date()));
  };

  if (!hasTaskAccess(role)) {
    return (
      <View style={[styles.flex, styles.guard, { paddingTop: insets.top + spacing.xl }]}>
        <Card>
          <Text style={type.headline}>Accès restreint</Text>
          <Text style={styles.guardText}>
            Votre rôle n’a pas accès au calendrier opérationnel.
          </Text>
        </Card>
      </View>
    );
  }

  const header = (
    <View style={styles.headerBlock}>
      {mode !== 'day' ? (
        <Card style={styles.gridCard}>
          {mode === 'month' ? (
            <MonthGrid
              anchor={selected}
              selected={selected}
              eventsByDay={data.eventsByDay}
              onSelect={setSelected}
            />
          ) : (
            <WeekStrip
              anchor={selected}
              selected={selected}
              eventsByDay={data.eventsByDay}
              onSelect={setSelected}
            />
          )}
        </Card>
      ) : null}

      {data.overdue.length > 0 ? (
        <View>
          <SectionLabel>En retard</SectionLabel>
          <Card style={styles.overdueCard}>
            {data.overdue.map((ev, i) => (
              <OverdueEventRow
                key={ev.key}
                event={ev}
                last={i === data.overdue.length - 1}
                onPress={() => openEvent(ev)}
              />
            ))}
          </Card>
        </View>
      ) : null}

      <View style={styles.agendaHeader}>
        <Text style={styles.agendaTitle}>
          {isToday ? 'Aujourd’hui' : fullDayLabel(selected)}
        </Text>
        {dayEvents.length > 0 ? (
          <Text style={type.caption}>
            {dayEvents.length} élément{dayEvents.length > 1 ? 's' : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.flex, { paddingTop: insets.top + layout.screenTop }]}>
      <View style={styles.titleRow}>
        <Text style={type.largeTitle}>Calendrier</Text>
        {!isToday ? (
          <Pressable
            onPress={goToday}
            accessibilityRole="button"
            accessibilityLabel="Revenir à aujourd’hui"
            style={({ pressed }) => [styles.todayButton, pressed && { opacity: 0.8 }]}
            hitSlop={6}
          >
            <Text style={styles.todayButtonText}>Aujourd’hui</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.navRow}>
        <View style={styles.navGroup}>
          <Pressable
            onPress={() => navigate(-1)}
            accessibilityRole="button"
            accessibilityLabel="Période précédente"
            style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}
            hitSlop={6}
          >
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.periodLabel} numberOfLines={1}>
            {periodLabel(mode, selected)}
          </Text>
          <Pressable
            onPress={() => navigate(1)}
            accessibilityRole="button"
            accessibilityLabel="Période suivante"
            style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}
            hitSlop={6}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.switcherWrap}>
        <CalendarViewSwitcher mode={mode} onChange={setMode} />
      </View>

      {error ? (
        <View style={styles.pad}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.pad, { gap: spacing.sm + 4 }]}>
          <Card><Skeleton height={mode === 'month' ? 240 : 64} /></Card>
          <Card><Skeleton height={56} /></Card>
          <Card><Skeleton height={56} /></Card>
        </View>
      ) : (
        <FlatList
          data={dayEvents}
          keyExtractor={(ev) => ev.key}
          contentContainerStyle={[
            styles.pad,
            { paddingBottom: layout.tabBarSpace, gap: spacing.sm + 2 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
          }
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <CalendarEventCard event={item} onPress={() => openEvent(item)} />
          )}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Ionicons name="calendar-clear-outline" size={26} color={colors.muted} />
              <Text style={styles.emptyText}>Aucun élément prévu ce jour.</Text>
            </Card>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  todayButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
    ...cardShadow,
  },
  todayButtonText: { fontSize: 13, fontWeight: '700', color: colors.orange },
  navRow: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  navGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  navButton: {
    width: layout.touch - 8,
    height: layout.touch - 8,
    borderRadius: (layout.touch - 8) / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  periodLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  switcherWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.sm + 4 },
  pad: { paddingHorizontal: spacing.md },
  headerBlock: { gap: spacing.md, marginBottom: spacing.sm },
  gridCard: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.xs },
  overdueCard: { paddingVertical: spacing.xs },
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  agendaTitle: { ...type.headline, fontSize: 18 },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  guard: { padding: spacing.md },
  guardText: { ...type.body, color: colors.textSecondary, marginTop: spacing.xs },
});
