/**
 * Calendrier — RLS-scoped agenda: task deadlines + video shootings/deliveries.
 * Tab hidden for roles the web denies tasks to (finance/commercial); video
 * events only fetched when the role has video access.
 */
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import {
  CALENDAR_RANGES,
  useCalendarWork,
  type CalendarItem,
  type CalendarRange,
} from '@/hooks/useCalendarWork';
import { hasTaskAccess } from '@/lib/roles';
import { CalendarWorkCard } from '@/components/calendar-work-card';
import { Card, ErrorBanner, Skeleton } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function dayHeader(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(d, today)) return 'Aujourd’hui';
  if (sameDay(d, tomorrow)) return 'Demain';
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

interface Section {
  title: string;
  data: CalendarItem[];
}

function buildSections(overdue: CalendarItem[], items: CalendarItem[]): Section[] {
  const sections: Section[] = [];
  if (overdue.length > 0) {
    sections.push({ title: 'En retard', data: overdue });
  }
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const header = dayHeader(item.at);
    const bucket = byDay.get(header);
    if (bucket) {
      bucket.push(item);
    } else {
      byDay.set(header, [item]);
    }
  }
  for (const [title, data] of byDay) {
    sections.push({ title, data });
  }
  return sections;
}

const EMPTY_LABELS: Record<CalendarRange, string> = {
  today: 'Rien de prévu aujourd’hui.',
  tomorrow: 'Rien de prévu demain.',
  week: 'Rien de prévu cette semaine.',
  upcoming: 'Rien de prévu dans les 30 prochains jours.',
};

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { employee } = useAuth();
  const role = employee?.role ?? null;
  const [range, setRange] = useState<CalendarRange>('today');
  const { data, loading, refreshing, error, refresh } = useCalendarWork(range, role);

  const sections = useMemo(
    () => buildSections(data.overdueItems, data.items),
    [data],
  );

  if (!hasTaskAccess(role)) {
    return (
      <View style={[styles.flex, styles.guard, { paddingTop: insets.top + spacing.xl }]}>
        <Card>
          <Text style={styles.guardTitle}>Accès restreint</Text>
          <Text style={styles.guardText}>
            Votre rôle n’a pas accès au calendrier opérationnel.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>Calendrier</Text>

      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {CALENDAR_RANGES.map((r) => {
            const active = r.key === range;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.pad}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.pad, { gap: spacing.sm + 4 }]}>
          <Card><Skeleton height={72} /></Card>
          <Card><Skeleton height={72} /></Card>
          <Card><Skeleton height={72} /></Card>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[styles.pad, { paddingBottom: spacing.xl, gap: spacing.sm + 4 }]}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
          }
          renderSectionHeader={({ section }) => (
            <Text
              style={[
                styles.sectionHeader,
                section.title === 'En retard' && { color: colors.danger },
              ]}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <CalendarWorkCard
              item={item}
              onPress={
                item.kind === 'task'
                  ? () => router.push(`/tasks/${item.entityId}`)
                  : () => router.push(`/videos/${item.entityId}`)
              }
            />
          )}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>{EMPTY_LABELS[range]}</Text>
            </Card>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.black,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  filterWrap: { marginBottom: spacing.sm + 4 },
  filterRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    minHeight: 38,
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: colors.black, borderColor: colors.black },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.black },
  filterTextActive: { color: colors.white },
  pad: { paddingHorizontal: spacing.md },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  guard: { padding: spacing.md },
  guardTitle: { fontSize: 16, fontWeight: '700', color: colors.black },
  guardText: { fontSize: 14, color: colors.muted, marginTop: spacing.xs, lineHeight: 20 },
});
