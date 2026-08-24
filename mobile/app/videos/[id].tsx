/**
 * Video detail — READ-ONLY in Phase 4. Status changes stay on the web:
 * the web workflow has server-side side effects (shooting events, linked
 * production task sync, notifications) that mobile must not duplicate.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useVideoDetail } from '@/hooks/useVideos';
import { hasVideoAccess } from '@/lib/roles';
import { TASK_STATUS_MAP, formatDateTime, formatDeadline } from '@/lib/task-meta';
import {
  VIDEO_FORMAT_LABELS,
  VIDEO_STATUS_MAP,
  effectiveClientDeliveryIso,
  isVideoDeliveryOverdue,
} from '@/lib/video-meta';
import { Badge } from '@/components/task-card';
import { Card, ErrorBanner, Skeleton } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import type { TaskStatus } from '@/types/db';

const WHITESPACE_RE = /\s+/;

const ROLE_LABEL: Record<string, string> = {
  editor: 'Monteur',
  cameraman: 'Cadreur',
};

export default function VideoDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, employee } = useAuth();
  const role = employee?.role ?? null;

  const videoId = typeof id === 'string' ? id : null;
  const { video, loading, error } = useVideoDetail(videoId);

  if (!session || !employee) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!hasVideoAccess(role)) {
    return <Redirect href="/(tabs)" />;
  }

  const status = video ? VIDEO_STATUS_MAP[video.status] : null;
  const overdue = video ? isVideoDeliveryOverdue(video) : false;
  const delivery = video ? formatDateTime(effectiveClientDeliveryIso(video)) : null;
  const shooting = video ? formatDateTime(video.shooting_date) : null;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/videos'))}
          accessibilityRole="button"
          accessibilityLabel="Retour aux vidéos"
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={colors.orange} />
          <Text style={styles.backText}>Vidéos</Text>
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
        ) : error || !video ? (
          <ErrorBanner message={error ?? 'Vidéo introuvable ou inaccessible.'} />
        ) : (
          <>
            <Text style={styles.title}>{video.title}</Text>
            {video.client_name ? <Text style={styles.client}>{video.client_name}</Text> : null}

            <View style={styles.badgeRow}>
              {status ? <Badge label={status.label} color={status.color} /> : null}
              {video.format ? (
                <Badge label={VIDEO_FORMAT_LABELS[video.format]} color={colors.muted} />
              ) : null}
              {overdue ? <Badge label="Livraison en retard" color={colors.danger} /> : null}
            </View>

            {video.topic || video.brief ? (
              <Card>
                <Text style={styles.sectionLabel}>Brief</Text>
                {video.topic ? <Text style={styles.topic}>{video.topic}</Text> : null}
                {video.brief ? <Text style={styles.brief}>{video.brief}</Text> : null}
              </Card>
            ) : null}

            <Card>
              <InfoRow label="Tournage" value={shooting ?? '—'} />
              <InfoRow label="Livraison client" value={delivery ?? '—'} danger={overdue} />
              <InfoRow label="Créée le" value={formatDeadline(video.created_at) ?? '—'} />
              <InfoRow label="Mise à jour" value={formatDeadline(video.updated_at) ?? '—'} last />
            </Card>

            {video.team.length > 0 ? (
              <Card>
                <Text style={styles.sectionLabel}>Équipe</Text>
                <View style={{ gap: spacing.sm }}>
                  {video.team.map((m) => (
                    <View key={m.id} style={styles.teamRow}>
                      <View
                        style={[styles.teamChip, { backgroundColor: m.avatar_color ?? colors.black }]}
                      >
                        <Text style={styles.teamChipText}>
                          {m.avatar_initials ??
                            m.full_name
                              .split(WHITESPACE_RE)
                              .slice(0, 2)
                              .map((p) => p[0]?.toUpperCase() ?? '')
                              .join('')}
                        </Text>
                      </View>
                      <Text style={styles.teamName}>{m.full_name}</Text>
                      {m.assignment_role ? (
                        <Text style={styles.teamRole}>{ROLE_LABEL[m.assignment_role]}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            {video.linkedTasks.length > 0 ? (
              <Card>
                <Text style={styles.sectionLabel}>Tâches liées</Text>
                <View style={{ gap: spacing.sm }}>
                  {video.linkedTasks.map((t) => {
                    const tStatus = TASK_STATUS_MAP[t.status as TaskStatus];
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => router.push(`/tasks/${t.id}`)}
                        style={({ pressed }) => [styles.linkedTask, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={styles.linkedTaskTitle} numberOfLines={1}>
                          {t.title}
                        </Text>
                        {tStatus ? <Badge label={tStatus.label} color={tStatus.color} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            ) : null}

            <Text style={styles.readOnlyHint}>
              Consultation seule — les changements de statut vidéo se font sur
              l’application web.
            </Text>
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
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
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
  topic: { fontSize: 15, fontWeight: '600', color: colors.black, marginBottom: spacing.xs },
  brief: { fontSize: 15, color: colors.black, lineHeight: 22 },
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
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teamChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamChipText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  teamName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.black },
  teamRole: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  linkedTask: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
  },
  linkedTaskTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.black },
  readOnlyHint: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
