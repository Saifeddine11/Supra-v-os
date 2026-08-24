/**
 * Projets du client — lecture seule (portal_my_projects).
 * Aucune donnée interne : ni budget, ni notes, ni équipe.
 */
import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClientWorkspace, type ClientProject } from '@/hooks/useClientWorkspace';
import { clientProjectBadge } from '@/lib/client-labels';
import { formatDeadline } from '@/lib/task-meta';
import { Badge } from '@/components/task-card';
import { Card, ErrorBanner, Skeleton } from '@/components/ui';
import { cardShadow, colors, layout, radius, spacing, type } from '@/constants/theme';

export function ProjectProgress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressText}>{pct}%</Text>
    </View>
  );
}

function ProjectCard({ project, onPress }: { project: ClientProject; onPress: () => void }) {
  const badge = clientProjectBadge(project.status, project.type);
  const deadline = formatDeadline(project.deadline);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${project.title}, ${badge.label}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {project.title}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </View>
      <View style={styles.metaRow}>
        <Badge label={badge.label} color={badge.color} />
        {project.type ? <Text style={styles.metaText}>{project.type}</Text> : null}
        {deadline ? <Text style={styles.metaDate}>{deadline}</Text> : null}
      </View>
      <ProjectProgress value={project.progress ?? 0} />
    </Pressable>
  );
}

export default function ClientProjectsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, loading, refreshing, error, refresh } = useClientWorkspace();

  return (
    <View style={[styles.flex, { paddingTop: insets.top + layout.screenTop }]}>
      <Text style={[type.largeTitle, styles.title]}>Projets</Text>

      {error ? (
        <View style={styles.pad}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.pad, { gap: spacing.sm + 4 }]}>
          <Card><Skeleton height={80} /></Card>
          <Card><Skeleton height={80} /></Card>
          <Card><Skeleton height={80} /></Card>
        </View>
      ) : (
        <FlatList
          data={data.projects}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[
            styles.pad,
            { paddingBottom: layout.tabBarSpace, gap: spacing.sm + 2 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
          }
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => router.push(`/(client)/projects/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Ionicons name="folder-open-outline" size={28} color={colors.muted} />
              <Text style={styles.emptyText}>Aucun projet pour le moment.</Text>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...cardShadow,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: 15.5, fontWeight: '600', color: colors.textPrimary, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  metaText: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '500' },
  metaDate: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginLeft: 'auto' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.fill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.orange },
  progressText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, width: 38, textAlign: 'right' },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
