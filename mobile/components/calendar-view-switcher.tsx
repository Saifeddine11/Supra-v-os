/**
 * Apple-style segmented control: Mois | Semaine | Jour.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { chipShadow, colors, radius, spacing } from '@/constants/theme';
import { hapticSelection } from '@/lib/haptics';

export type CalendarViewMode = 'month' | 'week' | 'day';

const MODES: { key: CalendarViewMode; label: string }[] = [
  { key: 'month', label: 'Mois' },
  { key: 'week', label: 'Semaine' },
  { key: 'day', label: 'Jour' },
];

export function CalendarViewSwitcher({
  mode,
  onChange,
}: {
  mode: CalendarViewMode;
  onChange: (mode: CalendarViewMode) => void;
}) {
  return (
    <View style={styles.track}>
      {MODES.map((m) => {
        const active = m.key === mode;
        return (
          <Pressable
            key={m.key}
            onPress={() => {
              if (!active) {
                hapticSelection();
                onChange(m.key);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`Vue ${m.label}`}
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.fill,
    borderRadius: radius.sm,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: 34,
    borderRadius: radius.sm - 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  segmentActive: {
    backgroundColor: colors.white,
    ...chipShadow,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.textPrimary },
});
