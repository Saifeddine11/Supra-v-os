/**
 * Task detail. "Marquer comme terminé" goes through RLS
 * (tasks_update_assigned_or_admin) — the UI gate (canChangeTaskStatus mirror)
 * only hides the button; the server decides.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { useAuth } from '@/hooks/useAuth';
import { SAFE_STATUSES, updateTaskStatus, useTaskDetail } from '@/hooks/useTasks';
import { hasTaskAccess, hasVideoAccess } from '@/lib/roles';
import { VIDEO_STATUS_MAP } from '@/lib/video-meta';
import { PRIORITY_MAP, TASK_STATUS_MAP, formatDateTime, formatDeadline, isTaskOverdue } from '@/lib/task-meta';
import type { TaskStatus, VideoStatus } from '@/types/db';
import { AssigneeChips, Badge } from '@/components/task-card';
import { Card, ErrorBanner, PrimaryButton, Skeleton } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';

export default function TaskDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, employee } = useAuth();
  const role = employee?.role ?? null;

  const taskId = typeof id === 'string' ? id : null;
  const { task, loading, error, reload } = useTaskDetail(taskId);

  const [saving, setSaving] = useState<TaskStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Protected route: this screen lives outside (tabs), so guard it directly.
  if (!session || !employee) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!hasTaskAccess(role)) {
    return <Redirect href="/(tabs)" />;
  }

  const onChangeStatus = async (status: TaskStatus) => {
    if (!taskId || saving || task?.status === status) return;
    setSaving(status);
    setActionError(null);
    setDone(false);
    const { error: err } = await updateTaskStatus(taskId, status);
    setSaving(null);
    if (err) {
      hapticError();
      setActionError(err);
      return;
    }
    hapticSuccess();
    if (status === 'done') setDone(true);
    await reload();
  };

  const status = task ? TASK_STATUS_MAP[task.status] : null;
  const priority = task ? PRIORITY_MAP[task.priority] : null;
  const overdue = task ? isTaskOverdue(task.deadline, task.status) : false;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/tasks'))}
          accessibilityRole="button"
          accessibilityLabel="Retour aux tâches"
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={colors.orange} />
          <Text style={styles.backText}>Tâches</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {loading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={28} width="80%" />
            <Card><Skeleton height={90} /></Card>
            <Card><Skeleton height={140} /></Card>
          </View>
        ) : error || !task ? (
          <ErrorBanner message={error ?? 'Tâche introuvable ou inaccessible.'} />
        ) : (
          <>
            <Text style={styles.title}>{task.title}</Text>
            {task.client_name ? <Text style={styles.client}>{task.client_name}</Text> : null}

            <View style={styles.badgeRow}>
              {status ? <Badge label={status.label} color={status.color} /> : null}
              {priority ? <Badge label={priority.label} color={priority.color} /> : null}
              {overdue ? <Badge label="En retard" color={colors.danger} /> : null}
            </View>

            {task.description ? (
              <Card>
                <Text style={styles.sectionLabel}>Description</Text>
                <Text style={styles.description}>{task.description}</Text>
              </Card>
            ) : null}

            <Card>
              <InfoRow label="Échéance" value={formatDateTime(task.deadline) ?? '—'} danger={overdue} />
              <InfoRow
                label="Terminée le"
                value={task.completed_at ? formatDateTime(task.completed_at) ?? '—' : '—'}
              />
              <InfoRow label="Créée le" value={formatDeadline(task.created_at) ?? '—'} />
              <InfoRow label="Mise à jour" value={formatDeadline(task.updated_at) ?? '—'} last />
            </Card>

            {task.linkedVideo && hasVideoAccess(role) ? (
              <Pressable
                onPress={() => router.push(`/videos/${task.linkedVideo!.id}`)}
                style={({ pressed }) => [styles.videoChip, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.videoChipLabel}>Vidéo liée</Text>
                <Text style={styles.videoChipTitle} numberOfLines={1}>
                  {task.linkedVideo.title}
                </Text>
                {VIDEO_STATUS_MAP[task.linkedVideo.status as VideoStatus] ? (
                  <Badge
                    label={VIDEO_STATUS_MAP[task.linkedVideo.status as VideoStatus].label}
                    color={VIDEO_STATUS_MAP[task.linkedVideo.status as VideoStatus].color}
                  />
                ) : null}
                <Text style={styles.videoChipChevron}>›</Text>
              </Pressable>
            ) : null}

            {task.assignees.length > 0 ? (
              <Card>
                <Text style={styles.sectionLabel}>Assignés</Text>
                <View style={styles.assigneeList}>
                  <AssigneeChips assignees={task.assignees} max={6} />
                  <Text style={styles.assigneeNames} numberOfLines={2}>
                    {task.assignees.map((a) => a.full_name).join(', ')}
                  </Text>
                </View>
              </Card>
            ) : null}

            {task.status !== 'archived' ? (
              <Card>
                <Text style={styles.sectionLabel}>Changer le statut</Text>
                <View style={styles.statusRow}>
                  {SAFE_STATUSES.map((s) => {
                    const cfg = TASK_STATUS_MAP[s];
                    const active = task.status === s;
                    const isSaving = saving === s;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => void onChangeStatus(s)}
                        disabled={saving != null || active}
                        style={[
                          styles.statusChip,
                          active && { backgroundColor: cfg.color, borderColor: cfg.color },
                          isSaving && { opacity: 0.6 },
                        ]}
                      >
                        <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                          {isSaving ? '…' : cfg.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            ) : null}

            {actionError ? <ErrorBanner message={actionError} /> : null}
            {done ? (
              <Card style={styles.successCard}>
                <Text style={styles.successText}>Tâche marquée comme terminée ✓</Text>
              </Card>
            ) : null}

            {task.status !== 'done' && task.status !== 'archived' ? (
              <PrimaryButton
                title="Marquer comme terminé"
                onPress={() => void onChangeStatus('done')}
                loading={saving === 'done'}
                disabled={saving != null}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({
  label,
  value,
  danger = false,
  last = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, danger && { color: colors.danger }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  backText: { fontSize: 16, fontWeight: '600', color: colors.orange },
  container: { paddingHorizontal: spacing.md, gap: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.black, lineHeight: 30 },
  client: { fontSize: 15, color: colors.muted, fontWeight: '600', marginTop: -spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  description: { fontSize: 15, color: colors.black, lineHeight: 22 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  infoValue: { fontSize: 14, color: colors.black, fontWeight: '600' },
  assigneeList: { gap: spacing.sm },
  assigneeNames: { fontSize: 14, color: colors.black, lineHeight: 20 },
  successCard: { borderColor: colors.success, backgroundColor: '#EAF7F0' },
  successText: { color: colors.success, fontWeight: '600', fontSize: 14 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  statusChipText: { fontSize: 13, fontWeight: '600', color: colors.black },
  statusChipTextActive: { color: colors.white },
  videoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  videoChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  videoChipTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.black },
  videoChipChevron: { fontSize: 20, fontWeight: '700', color: colors.orange },
});
