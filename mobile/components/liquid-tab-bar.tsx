/**
 * LiquidTabBar — barre de navigation flottante « liquid glass ».
 *
 * Pilule translucide (blur iOS / repli opaque Android), capsule active
 * verre translucide avec liseré + icône orange Supra, halo orange discret,
 * safe-area respectée. Tous les réglages visuels passent par les tokens
 * `glass` / `tab` / `tabBar` de constants/theme.ts.
 *
 * ⚠️ Masquage par rôle : expo-router traduit `href: null` en
 * `tabBarItemStyle: { display: 'none' }` + `tabBarButton -> null`, MAIS la
 * route reste présente dans `state.routes`. Une barre personnalisée doit donc
 * filtrer explicitement, sinon les onglets masqués par rôle réapparaissent
 * (finance/commercial → Tâches/Calendrier, rôles sans vidéo → Vidéos).
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { hapticSelection } from '@/lib/haptics';
import {
  activeGlassShadow,
  colors,
  glass,
  glassShadow,
  layout,
  tab,
  tabBar,
} from '@/constants/theme';

const IS_IOS = Platform.OS === 'ios';
const ICON_SIZE = 22;
/** Au-delà de 4 onglets, on réduit le libellé (iPhone SE ≈ 66 pt/onglet). */
const COMPACT_FROM = 5;

/** Onglet masqué par rôle (voir en-tête). */
function isHiddenTab(options: { tabBarItemStyle?: unknown }): boolean {
  const flat = StyleSheet.flatten(options.tabBarItemStyle as ViewStyle | undefined);
  return flat?.display === 'none';
}

/** Texte du badge (« 99+ » au-delà de 99 ; chaîne vide ⇒ pastille seule). */
function badgeText(badge: number | string): string {
  if (typeof badge === 'number') return badge > 99 ? '99+' : String(badge);
  return badge;
}

function TabItem({
  focused,
  label,
  labelSize,
  accessibilityLabel,
  badge,
  renderIcon,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  label: string;
  labelSize: number;
  accessibilityLabel: string;
  badge?: number | string;
  renderIcon: (color: string) => React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
}) {
  // 0 → 1 : apparition de la capsule active (opacity + scale, native driver).
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    const anim = Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    });
    anim.start();
    return () => anim.stop();
  }, [focused, progress]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1],
  });

  const hasBadge = badge !== undefined && badge !== null;
  const text = hasBadge ? badgeText(badge) : '';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      style={styles.item}
      hitSlop={4}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.capsule, { opacity: progress, transform: [{ scale }] }]}
      />

      <View style={styles.itemContent} pointerEvents="none">
        <View style={styles.iconWrap}>
          {renderIcon(focused ? tab.activeIcon : tab.inactiveText)}
          {hasBadge ? (
            <View style={[styles.badge, text.length === 0 && styles.badgeDot]}>
              {text.length > 0 ? (
                <Text style={styles.badgeText} numberOfLines={1}>
                  {text}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { fontSize: labelSize },
            focused ? styles.labelActive : styles.labelInactive,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function LiquidTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const focusedKey = state.routes[state.index]?.key;

  const visible = state.routes.filter((route) => !isHiddenTab(descriptors[route.key].options));
  if (visible.length === 0) return null;

  const labelSize =
    visible.length >= COMPACT_FROM ? tabBar.labelSizeCompact : tabBar.labelSize;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, tabBar.bottomGap) + tabBar.bottomGap / 2 },
      ]}
    >
      <View style={styles.shadowHost}>
        <View style={styles.pill}>
          {IS_IOS ? (
            <BlurView
              intensity={glass.blurIntensity}
              tint={glass.blurTint}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          {/* Teinte verre au-dessus du blur (opaque-ish sans blur sur Android). */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: IS_IOS ? tab.glass : tab.glassSolid },
            ]}
            pointerEvents="none"
          />
          {/* Reflet interne haut — effet « bord de verre ». */}
          <View style={styles.topHighlight} pointerEvents="none" />

          <View style={styles.row}>
            {visible.map((route) => {
              const { options } = descriptors[route.key];
              const focused = route.key === focusedKey;

              const label =
                typeof options.tabBarLabel === 'string'
                  ? options.tabBarLabel
                  : (options.title ?? route.name);

              const badge = options.tabBarBadge;
              const a11y =
                options.tabBarAccessibilityLabel ??
                (badge !== undefined && badge !== null
                  ? `${label}, ${badgeText(badge)} en attente`
                  : label);

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  hapticSelection();
                  navigation.navigate(route.name, route.params);
                }
              };

              const onLongPress = () => {
                navigation.emit({ type: 'tabLongPress', target: route.key });
              };

              return (
                <TabItem
                  key={route.key}
                  focused={focused}
                  label={label}
                  labelSize={labelSize}
                  accessibilityLabel={a11y}
                  badge={badge}
                  renderIcon={(color) =>
                    options.tabBarIcon?.({ focused, color, size: ICON_SIZE }) ?? null
                  }
                  onPress={onPress}
                  onLongPress={onLongPress}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Porte l'ombre : pas d'overflow hidden ici (iOS clipperait l'ombre).
  shadowHost: {
    marginHorizontal: tabBar.sideMargin,
    borderRadius: tabBar.radius,
    backgroundColor: 'transparent',
    ...glassShadow,
  },
  // Clippe le blur et le reflet au rayon de la pilule.
  pill: {
    height: tabBar.height,
    borderRadius: tabBar.radius,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tab.glassBorder,
    justifyContent: 'center',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: glass.highlight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    minHeight: layout.touch,
    height: tabBar.height - 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Capsule active « verre » : blanc translucide + liseré orange discret.
  // marginVertical ⇒ capsule de 50 pt de haut dans une zone tactile de 58 pt.
  capsule: {
    ...StyleSheet.absoluteFillObject,
    marginHorizontal: 3,
    marginVertical: 4,
    borderRadius: tabBar.itemRadius,
    backgroundColor: tab.activeGlassBackground,
    borderWidth: 1,
    borderColor: tab.activeGlassBorder,
    ...activeGlassShadow,
  },
  itemContent: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeDot: { minWidth: 10, width: 10, height: 10, borderRadius: 5, top: -3, right: -5, paddingHorizontal: 0 },
  badgeText: { color: colors.white, fontSize: 9.5, fontWeight: '800' },
  label: { fontWeight: '600', letterSpacing: 0.1 },
  labelActive: { color: tab.activeText },
  labelInactive: { color: tab.inactiveText },
});
