/**
 * Accueil client — lecture seule, données 100 % issues des RPC client-safe.
 */
import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import {
  useClientPlanning,
  useClientWorkspace,
  type ClientPlanningItem,
} from '@/hooks/useClientWorkspace';
import {
  isActiveClientProject,
  isActiveClientVideo,
  isAwaitingClientValidation,
} from '@/lib/client-labels';
import { formatDateTime } from '@/lib/task-meta';
import { hapticLight } from '@/lib/haptics';
import { Card, ErrorBanner, SectionLabel, Skeleton } from '@/components/ui';
import { cardShadow, colors, layout, radius, spacing, type } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const KIND_LABEL: Record<ClientPlanningItem['kind'], string> = {
  shooting: 'Tournage',
  delivery: 'Livraison',
  publication: 'Publication',
};

function StatCard({
  label,
  value,
  icon,
  tint = colors.textSecondary,
  onPress,
}: {
  label: string;
  value: number;
  icon: IoniconName;
  tint?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress ? () => { hapticLight(); onPress(); } : undefined}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value}`}
      style={({ pressed }) => [styles.statPressable, pressed && !!onPress && { opacity: 0.75 }]}
    >
      <Card style={styles.statCard}>
        <View style={[styles.statIcon, { backgroundColor: `${tint}14` }]}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Card>
    </Pressable>
  );
}

function QuickAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IoniconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => { hapticLight(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={16} color={colors.textPrimary} />
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

export default function ClientHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clientUser } = useAuth();
  const { data, loading, refreshing, error, refresh } = useClientWorkspace();
  const planning = useClientPlanning(data.videos);

  const firstName = (data.client?.full_name ?? clientUser?.full_name ?? '').split(' ')[0];
  const clientName = data.client?.name ?? clientUser?.name ?? '';

  const activeProjects = data.projects.filter((p) => isActiveClientProject(p.status)).length;
  const activeVideos = data.videos.filter((v) => isActiveClientVideo(v.public_status)).length;
  const awaiting = data.videos.filter((v) => isAwaitingClientValidation(v.public_status)).length;
  const nextShootings = planning.filter((p) => p.kind === 'shooting').length;
  const nextDeliveries = planning.filter((p) => p.kind === 'delivery').length;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + layout.screenTop, paddingBottom: layout.tabBarSpace },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} />
      }
    >
      <View style={styles.headerBlock}>
        <Text style={type.largeTitle} numberOfLines={2}>
          Bonjour {firstName}
        </Text>
        {clientName ? (
          <View style={styles.clientBadge}>
            <Text style={styles.clientBadgeText}>{clientName}</Text>
          </View>
        ) : null}
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <View style={styles.grid}>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={64} /></Card>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={64} /></Card>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={64} /></Card>
          <Card style={[styles.statPressable, styles.statCard]}><Skeleton height={64} /></Card>
        </View>
      ) : (
        <View style={styles.grid}>
          <StatCard
            label="Projets actifs"
            value={activeProjects}
            icon="folder-outline"
            onPress={() => router.push('/(client)/projects')}
          />
          <StatCard
            label="Vidéos en cours"
            value={activeVideos}
            icon="videocam-outline"
            tint={colors.info}
            onPress={() => router.push('/(client)/videos')}
          />
          <StatCard
            label="En attente de validation"
            value={awaiting}
            icon="eye-outline"
            tint={awaiting > 0 ? colors.orange : colors.textSecondary}
            onPress={() => router.push('/(client)/videos')}
          />
          <StatCard
            label="Prochains tournages"
            value={nextShootings}
            icon="camera-outline"
            tint="#4FA3A0"
            onPress={() => router.push('/(client)/planning')}
          />
          <StatCard
            label="Livraisons à venir"
            value={nextDeliveries}
            icon="paper-plane-outline"
            tint="#C49A4B"
            onPress={() => router.push('/(client)/planning')}
          />
        </View>
      )}

      <View style={styles.quickRow}>
        <QuickAction
          label="Voir projets"
          icon="folder-outline"
          onPress={() => router.push('/(client)/projects')}
        />
        <QuickAction
          label="Voir planning"
          icon="calendar-outline"
          onPress={() => router.push('/(client)/planning')}
        />
        <QuickAction
          label="Voir vidéos"
          icon="videocam-outline"
          onPress={() => router.push('/(client)/videos')}
        />
      </View>

      {!loading && planning.length > 0 ? (
        <View>
          <SectionLabel>À venir</SectionLabel>
          <Card style={styles.upcomingCard}>
            {planning.slice(0, 3).map((item, i, arr) => (
              <View
                key={item.key}
                style={[styles.upcomingRow, i < arr.length - 1 && styles.upcomingRowBorder]}
              >
                <View style={styles.upcomingTexts}>
                  <Text style={styles.upcomingTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={type.caption}>
                    {KIND_LABEL[item.kind]} · {formatDateTime(item.at)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  container: { paddingHorizontal: spacing.md, gap: spacing.md },
  headerBlock: { gap: spacing.sm },
  clientBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.orangeSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  clientBadgeText: { fontSize: 12.5, fontWeight: '700', color: colors.orange },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 4 },
  statPressable: { flexBasis: '47%', flexGrow: 1 },
  statCard: { minHeight: 108, justifyContent: 'center', gap: 2 },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '500' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    minHeight: layout.touch,
    ...cardShadow,
  },
  quickActionText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  upcomingCard: { paddingVertical: spacing.xs },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.touch + 6,
    paddingVertical: spacing.xs,
  },
  upcomingRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  upcomingTexts: { flex: 1, gap: 1 },
  upcomingTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
});
