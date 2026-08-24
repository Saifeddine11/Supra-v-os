/**
 * Shared UI primitives — iOS-flavored: borderless floating cards, capsule
 * chips, quiet section labels, soft banners, big touch targets.
 */
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { cardShadow, colors, layout, radius, spacing, type } from '@/constants/theme';
import { hapticSelection } from '@/lib/haptics';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Uppercase quiet section label (iOS grouped-list style). */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.textPrimary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'ghost' && styles.buttonTextGhost,
            variant === 'danger' && styles.buttonTextDanger,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Horizontally scrollable capsule filter chips (shared by list screens). */
export function FilterChips<K extends string>({
  options,
  active,
  onSelect,
}: {
  options: readonly { key: K; label: string }[];
  active: K;
  onSelect: (key: K) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {options.map((o) => {
        const isActive = o.key === active;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              hapticSelection();
              onSelect(o.key);
            }}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: isActive }}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** iOS grouped-list row: label left, value/accessory right. */
export function ListRow({
  label,
  value,
  danger = false,
  last = false,
  onPress,
  chevron = false,
}: {
  label: string;
  value?: string;
  danger?: boolean;
  last?: boolean;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const content = (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, danger && { color: colors.danger }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {chevron ? <Text style={styles.rowChevron}>›</Text> : null}
      </View>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [pressed && { opacity: 0.6 }]}
    >
      {content}
    </Pressable>
  );
}

export function Skeleton({ height = 20, width = '100%' as ViewStyle['width'] }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.skeleton, { height, width, opacity }]} />;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...cardShadow,
  },
  sectionLabel: {
    ...type.sectionHeader,
    marginBottom: spacing.sm,
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonGhost: {
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  buttonDanger: { backgroundColor: colors.dangerSoft },
  buttonPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  buttonTextGhost: { color: colors.textPrimary },
  buttonTextDanger: { color: colors.danger },
  chipRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
  chip: {
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.black },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: layout.touch,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowLabel: { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  rowValue: { fontSize: 15, color: colors.textPrimary, fontWeight: '600', flexShrink: 1 },
  rowChevron: { fontSize: 18, color: colors.muted, fontWeight: '600' },
  skeleton: {
    borderRadius: radius.sm,
    backgroundColor: colors.fill,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.sm + 4,
  },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: '500' },
});
