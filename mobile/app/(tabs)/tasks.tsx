/**
 * Tâches — RLS-scoped task list with filter chips.
 * Roles without task access (finance/commercial) never reach this screen:
 * the tab is hidden in (tabs)/_layout.tsx and a guard renders a notice here.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { TASK_FILTERS, useTasks, type TaskFilter } from '@/hooks/useTasks';
import { hasTaskAccess, isAdminOrPM } from '@/lib/roles';
import { TaskCard } from '@/components/task-card';
import { Card, ErrorBanner, Skeleton } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';

const EMPTY_LABELS: Record<TaskFilter, string> = {
  all: 'Aucune tâche visible pour le moment.',
  todo: 'Aucune tâche à faire.',
  in_progress: 'Aucune tâche en cours.',
  review: 'Aucune tâche en révision.',
  blocked: 'Aucune tâche bloquée.',
  done: 'Aucune tâche terminée.',
  overdue: 'Aucune tâche en retard. 👌',
};

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { employee } = useAuth();
  const role = employee?.role ?? null;
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { tasks, loading, refreshing, error, refresh, reload } = useTasks(filter, debouncedSearch);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Silent re-sync when returning (e.g. after creating a task).
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const searching = debouncedSearch.trim().length >= 2;

  if (!hasTaskAccess(role)) {
    return (
      <View style={[styles.flex, styles.guard, { paddingTop: insets.top + spacing.xl }]}>
        <Card>
          <Text style={styles.guardTitle}>Accès restreint</Text>
          <Text style={styles.guardText}>
            Votre rôle n’a pas accès aux tâches. Contactez un administrateur si
            besoin.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Tâches</Text>
        {isAdminOrPM(role) ? (
          <Pressable
            onPress={() => router.push('/tasks/new')}
            style={({ pressed }) => [styles.newButton, pressed && { opacity: 0.85 }]}
            hitSlop={6}
          >
            <Text style={styles.newButtonText}>+ Nouvelle tâche</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une tâche…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 ? (
          <Pressable
            onPress={() => setSearch('')}
            hitSlop={8}
            style={styles.searchClear}
          >
            <Text style={styles.searchClearText}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {TASK_FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {f.label}
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
          <Card><Skeleton height={64} /></Card>
          <Card><Skeleton height={64} /></Card>
          <Card><Skeleton height={64} /></Card>
          <Card><Skeleton height={64} /></Card>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          contentContainerStyle={[styles.pad, { paddingBottom: spacing.xl, gap: spacing.sm + 4 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
          }
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={() => router.push(`/tasks/${item.id}`)} />
          )}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {searching ? 'Aucune tâche trouvée.' : EMPTY_LABELS[filter]}
              </Text>
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
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.black,
  },
  newButton: {
    backgroundColor: colors.orange,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  newButtonText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  searchWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm + 4,
    justifyContent: 'center',
  },
  searchInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingRight: spacing.xl + spacing.sm,
    fontSize: 15,
    color: colors.black,
  },
  searchClear: {
    position: 'absolute',
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: { fontSize: 15, color: colors.muted, fontWeight: '600' },
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
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  guard: { padding: spacing.md },
  guardTitle: { fontSize: 16, fontWeight: '700', color: colors.black },
  guardText: { fontSize: 14, color: colors.muted, marginTop: spacing.xs, lineHeight: 20 },
});
