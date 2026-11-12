import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInventory } from '../hooks/useAppServices';
import type { IconName } from '../theme/categoryStyle';
import { useTheme } from '../theme/ThemeProvider';
import { tap } from './glass/Controls';
import { GlassView } from './glass/GlassView';
import { Icon } from './Icon';
import { Txt } from './Txt';

export const TAB_BAR_HEIGHT = 72;

type TabButtonProps = TabTriggerSlotProps & { icon: IconName; activeIcon: IconName; label: string; badge?: number };

function TabButton({ icon, activeIcon, label, badge = 0, isFocused, onPress, ref, ...props }: TabButtonProps) {
  const { tokens } = useTheme();
  const color = isFocused ? tokens.textPrimary : tokens.textMuted;
  return (
    <Pressable
      {...props}
      onPress={(event) => {
        if (!isFocused) tap();
        onPress?.(event);
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={badge > 0 ? `${label}, ${badge} alerts` : label}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <View>
        <Icon name={isFocused ? activeIcon : icon} size={22} color={color} />
        {badge > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -5,
              right: -12,
              minWidth: 18,
              height: 16,
              paddingHorizontal: 4,
              borderRadius: 8,
              backgroundColor: tokens.expired,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt variant="eyebrow" color="#FBF7F0" style={{ fontSize: 9.5, letterSpacing: 0, lineHeight: 12 }}>
              {badge > 99 ? '99+' : badge}
            </Txt>
          </View>
        ) : null}
      </View>
      <Txt variant="labelMedium" color={color} numberOfLines={1} style={{ fontSize: 10.5, letterSpacing: 0.4, marginTop: 4 }}>
        {label}
      </Txt>
      <View style={{ marginTop: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: isFocused ? tokens.accent : 'transparent' }} />
    </Pressable>
  );
}

/** Floating frosted navigation pill with a solid "add" action in the middle. */
export function GlassTabBar() {
  const { tokens } = useTheme();
  const { state } = useInventory();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      {/* Content scrolling beneath the bar dissolves instead of being cut off. */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${tokens.backgroundBottom}00`, `${tokens.backgroundBottom}F0`]}
        locations={[0, 0.6]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: TAB_BAR_HEIGHT + insets.bottom + 40 }}
      />
      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 28 }}>
        <GlassView strong radius={TAB_BAR_HEIGHT / 2} style={{ height: TAB_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', padding: 6 }}>
          <TabTrigger name="index" asChild>
            <TabButton icon="space-dashboard" activeIcon="space-dashboard" label="Overview" />
          </TabTrigger>
          <TabTrigger name="inventory" asChild>
            <TabButton icon="inventory-2" activeIcon="inventory-2" label="Inventory" />
          </TabTrigger>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add asset"
            testID="add-asset"
            onPress={() => {
              tap();
              router.push('/asset-form');
            }}
            style={({ pressed }) => ({
              marginHorizontal: 8,
              width: 52,
              height: 52,
              borderRadius: 26,
              overflow: 'hidden',
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <LinearGradient
              colors={[...tokens.buttonColors]}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderTopWidth: 0.8, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 26 }}
            >
              <Icon name="add" size={26} color={tokens.onButton} />
            </LinearGradient>
          </Pressable>
          <TabTrigger name="alerts" asChild>
            <TabButton icon="notifications-none" activeIcon="notifications-active" label="Alerts" badge={state.stats.attention} />
          </TabTrigger>
          <TabTrigger name="settings" asChild>
            <TabButton icon="tune" activeIcon="tune" label="Settings" />
          </TabTrigger>
        </GlassView>
      </View>
    </View>
  );
}
