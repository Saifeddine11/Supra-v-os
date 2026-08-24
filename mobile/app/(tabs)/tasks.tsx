/**
 * Tâches — RLS-scoped task list, Apple Reminders / Linear feel.
 * Roles without task access (finance/commercial) never reach this screen:
 * the tab is hidden in (tabs)/_layout.tsx and a guard renders a notice here.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { TASK_FILTERS, useTasks, type TaskFilter } from '@/hooks/useTasks';
import { hasTaskAccess, isAdminOrPM } from '@/lib/roles';
import { hapticLight } from '@/lib/haptics';
import { TaskCard } from '@/components/task-card';
import { Card, ErrorBanner, FilterChips, Skeleton } from '@/components/ui';
import { cardShadow, colors, layout, radius, spacing, type } from '@/constants/theme';

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
          <Text style={type.headline}>Accès restreint</Text>
          <Text style={styles.guardText}>
            Votre rôle n’a pas accès aux tâches. Contactez un administrateur si
            besoin.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + layout.screenTop }]}>
      <View style={styles.titleRow}>
        <Text style={type.largeTitle}>Tâches</Text>
        {isAdminOrPM(role) ? (
          <Pressable
            onPress={() => {
              hapticLight();
              router.push('/tasks/new');
            }}
            accessibilityRole="button"
            accessibilityLabel="Nouvelle tâche"
            style={({ pressed }) => [styles.newButton, pressed && { opacity: 0.85 }]}
            hitSlop={6}
          >
            <Ionicons name="add" size={22} color={colors.white} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une tâche…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Rechercher une tâche"
        />
        {search.length > 0 ? (
          <Pressable
            onPress={() => setSearch('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
            style={styles.searchClear}
          >
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterWrap}>
        <FilterChips options={TASK_FILTERS} active={filter} onSelect={setFilter} />
      </View>

      {error ? (
        <View style={styles.pad}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.pad, { gap: spacing.sm + 4 }]}>
          <Card><Skeleton height={56} /></Card>
          <Card><Skeleton height={56} /></Card>
          <Card><Skeleton height={56} /></Card>
          <Card><Skeleton height={56} /></Card>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          contentContainerStyle={[
            styles.pad,
            { paddingBottom: layout.tabBarSpace, gap: spacing.sm + 2 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
          }
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={() => router.push(`/tasks/${item.id}`)} />
          )}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Ionicons name="checkmark-done-circle-outline" size={28} color={colors.muted} />
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
    marginBottom: spacing.sm + 2,
    gap: spacing.sm,
  },
  newButton: {
    width: layout.touch - 4,
    height: layout.touch - 4,
    borderRadius: (layout.touch - 4) / 2,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  searchWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.sm,
    minHeight: 40,
    paddingHorizontal: spacing.sm + 2,
  },
  searchIcon: { marginRight: spacing.xs + 2 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
    minHeight: 40,
  },
  searchClear: { padding: spacing.xs },
  filterWrap: { marginBottom: spacing.sm + 4 },
  pad: { paddingHorizontal: spacing.md },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  guard: { padding: spacing.md },
  guardText: { ...type.body, color: colors.textSecondary, marginTop: spacing.xs },
});
