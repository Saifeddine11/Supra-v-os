/**
 * Planning client — tournages, livraisons et publications à venir.
 *
 * Aucune RPC dédiée n'existe côté production : le planning est dérivé des
 * dates renvoyées par `portal_my_videos()` (voir buildClientPlanning), donc
 * strictement limité au périmètre du client.
 */
import React, { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useClientPlanning,
  useClientWorkspace,
  type ClientPlanningItem,
} from '@/hooks/useClientWorkspace';
import { videoPublicStatusBadge } from '@/lib/client-labels';
import { fullDayLabel, timeLabel } from '@/lib/calendar-utils';
import { Badge } from '@/components/task-card';
import { Card, ErrorBanner, Skeleton } from '@/components/ui';
import { cardShadow, colors, layout, radius, spacing, type } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const KIND_META: Record<
  ClientPlanningItem['kind'],
  { label: string; icon: IoniconName; color: string }
> = {
  shooting: { label: 'Tournage', icon: 'videocam-outline', color: '#4FA3A0' },
  delivery: { label: 'Livraison', icon: 'paper-plane-outline', color: '#C49A4B' },
  publication: { label: 'Publication', icon: 'megaphone-outline', color: colors.success },
};

function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : fullDayLabel(d);
}

export default function ClientPlanningScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, refreshing, error, refresh } = useClientWorkspace();
  const planning = useClientPlanning(data.videos);

  const sections = useMemo(() => {
    const byDay = new Map<string, ClientPlanningItem[]>();
    for (const item of planning) {
      const key = dayKeyOf(item.at);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(item);
      else byDay.set(key, [item]);
    }
    return [...byDay.entries()].map(([title, items]) => ({ title, data: items }));
  }, [planning]);

  return (
    <View style={[styles.flex, { paddingTop: insets.top + layout.screenTop }]}>
      <Text style={[type.largeTitle, styles.title]}>Planning</Text>

      {error ? (
        <View style={styles.pad}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.pad, { gap: spacing.sm + 4 }]}>
          <Card><Skeleton height={64} /></Card>
          <Card><Skeleton height={64} /></Card>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.pad,
            { paddingBottom: layout.tabBarSpace, gap: spacing.sm + 2 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const meta = KIND_META[item.kind];
            const badge = videoPublicStatusBadge(item.publicStatus);
            const time = timeLabel(item.at);
            return (
              <View style={styles.row}>
                <View style={[styles.kindBar, { backgroundColor: meta.color }]} />
                <View style={styles.timeCol}>
                  <Text style={styles.time}>{time ?? 'Journée'}</Text>
                  <View style={styles.kindRow}>
                    <Ionicons name={meta.icon} size={12} color={meta.color} />
                    <Text style={[styles.kindLabel, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <View style={styles.body}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Badge label={badge.label} color={badge.color} />
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Ionicons name="calendar-clear-outline" size={28} color={colors.muted} />
              <Text style={styles.emptyText}>Aucun élément planifié pour le moment.</Text>
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
  sectionHeader: { ...type.sectionHeader, marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingRight: spacing.md,
    paddingLeft: spacing.sm + 2,
    ...cardShadow,
  },
  kindBar: { width: 3.5, alignSelf: 'stretch', borderRadius: 2 },
  timeCol: { width: 74, gap: 2 },
  time: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  kindLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  body: { flex: 1, gap: spacing.xs, alignItems: 'flex-start' },
  rowTitle: { fontSize: 14.5, fontWeight: '600', color: colors.textPrimary, lineHeight: 19 },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
