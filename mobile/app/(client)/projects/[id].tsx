/**
 * Détail projet client — lecture seule.
 *
 * ⚠️ Les vidéos liées ne sont PAS affichées : la RPC `portal_my_videos()` ne
 * renvoie pas `project_id` (colonnes volontairement minimales côté serveur).
 * Les rattacher nécessiterait une évolution backend — non faite ici, l'espace
 * client web restant intouché. Voir le rapport.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useClientWorkspace } from '@/hooks/useClientWorkspace';
import { clientProjectBadge } from '@/lib/client-labels';
import { formatDeadline } from '@/lib/task-meta';
import { Badge } from '@/components/task-card';
import { ProjectProgress } from '@/app/(client)/projects';
import { Card, ErrorBanner, ListRow, SectionLabel, Skeleton } from '@/components/ui';
import { colors, layout, spacing, type } from '@/constants/theme';

export default function ClientProjectDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, accountType } = useAuth();
  const { data, loading, error } = useClientWorkspace();

  if (!session || accountType !== 'client') {
    return <Redirect href="/(auth)/login" />;
  }

  const project = data.projects.find((p) => p.id === id) ?? null;
  const badge = project ? clientProjectBadge(project.status, project.type) : null;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(client)/projects')
          }
          accessibilityRole="button"
          accessibilityLabel="Retour aux projets"
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={colors.orange} />
          <Text style={styles.backText}>Projets</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: layout.tabBarSpace }]}
      >
        {loading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={28} width="80%" />
            <Card><Skeleton height={120} /></Card>
          </View>
        ) : error ? (
          <ErrorBanner message={error} />
        ) : !project ? (
          <ErrorBanner message="Projet introuvable." />
        ) : (
          <>
            <Text style={styles.title}>{project.title}</Text>
            <View style={styles.badgeRow}>
              {badge ? <Badge label={badge.label} color={badge.color} /> : null}
              {project.type ? <Badge label={project.type} color={colors.textSecondary} /> : null}
            </View>

            <View>
              <SectionLabel>Avancement</SectionLabel>
              <Card style={styles.progressCard}>
                <ProjectProgress value={project.progress ?? 0} />
              </Card>
            </View>

            <View>
              <SectionLabel>Dates</SectionLabel>
              <Card style={styles.groupCard}>
                <ListRow label="Échéance" value={formatDeadline(project.deadline) ?? '—'} />
                <ListRow
                  label="Livré le"
                  value={formatDeadline(project.delivered_at) ?? '—'}
                  last
                />
              </Card>
            </View>

            <Text style={styles.note}>
              Retrouvez l’ensemble de vos contenus dans l’onglet Vidéos.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  backButton: {
    minHeight: layout.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  backText: { fontSize: 16, fontWeight: '600', color: colors.orange },
  container: { paddingHorizontal: spacing.md, gap: spacing.md },
  title: { ...type.largeTitle, fontSize: 24, lineHeight: 30 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  progressCard: { paddingVertical: spacing.md },
  groupCard: { paddingVertical: spacing.xs },
  note: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
