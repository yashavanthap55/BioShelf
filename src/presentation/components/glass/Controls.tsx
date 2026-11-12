import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { IconName } from '../../theme/categoryStyle';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { GlassView } from './GlassView';

export const tap = () => {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
};

export function IconButton({
  icon,
  label,
  onPress,
  size = 44,
  color,
  blur = true,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  color?: string;
  blur?: boolean;
  disabled?: boolean;
}) {
  return (
    <GlassView
      radius={size / 2}
      blur={blur}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityLabel={label}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <Icon name={icon} size={size * 0.42} color={color} />
    </GlassView>
  );
}

/**
 * Primary call to action: a solid metallic (dark theme) or ink (light theme)
 * pill with a fine top sheen and a neutral shadow.
 */
export function PrimaryButton({
  label,
  onPress,
  icon,
  loading = false,
  destructive = false,
  disabled = false,
  height = 54,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  loading?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { tokens } = useTheme();
  const colors: [string, string] = destructive ? [tokens.expired, tokens.expired] : [...tokens.buttonColors];
  const foreground = destructive ? '#FBF7F0' : tokens.onButton;
  const enabled = !disabled && !loading && !!onPress;
  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        {
          height,
          borderRadius: height / 2,
          shadowColor: '#000',
          shadowOpacity: tokens.scheme === 'dark' ? 0.35 : 0.15,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 4,
          opacity: enabled || loading ? (pressed ? 0.88 : 1) : 0.45,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: height / 2, borderTopWidth: 0.8, borderColor: 'rgba(255,255,255,0.28)' },
        ]}
      />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 22 }}>
        {loading ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Icon name={icon} size={19} color={foreground} /> : null}
        <Txt variant="label" color={foreground} numberOfLines={1} style={{ fontSize: 15, letterSpacing: 0.3 }}>
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

/** Secondary action: a quiet glass pill. */
export function SecondaryButton({
  label,
  onPress,
  icon,
  color,
  height = 54,
  style,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  const foreground = color ?? tokens.textPrimary;
  return (
    <GlassView
      radius={height / 2}
      blur={false}
      onPress={disabled ? undefined : onPress}
      accessibilityLabel={label}
      borderColor={color}
      style={[
        { height, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={foreground} /> : null}
      <Txt variant="label" color={foreground} numberOfLines={1} style={{ fontSize: 15, letterSpacing: 0.3 }}>
        {label}
      </Txt>
    </GlassView>
  );
}

export function TextButton({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  const { tokens } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 6, paddingHorizontal: 4 })}>
      <Txt variant="label" color={color ?? tokens.accent}>
        {label}
      </Txt>
    </Pressable>
  );
}

/**
 * Selectable filter chip. Selection is a fine accent hairline rather than a
 * colour flood; [color] only tints the icon or dot.
 */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
  count,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  color?: string;
  count?: number;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 14,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: selected ? tokens.accent : tokens.borderFaint,
        backgroundColor: selected ? (tokens.scheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(27,25,21,0.05)') : 'transparent',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {icon ? (
        <Icon name={icon} size={15} color={color ?? (selected ? tokens.accent : tokens.textMuted)} />
      ) : color ? (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      ) : null}
      <Txt variant="label" color={selected ? tokens.textPrimary : tokens.textSecondary} style={{ fontSize: 13 }}>
        {label}
      </Txt>
      {count !== undefined ? (
        <Txt variant="label" color={selected ? tokens.accent : tokens.textMuted} style={{ fontSize: 12 }}>
          {count}
        </Txt>
      ) : null}
    </Pressable>
  );
}

export interface Segment<T> {
  value: T;
  label: string;
  icon?: IconName;
}

/** Segmented control with a sliding frosted indicator. */
export function SegmentedControl<T>({
  segments,
  selected,
  onChange,
}: {
  segments: readonly Segment<T>[];
  selected: T;
  onChange: (value: T) => void;
}) {
  const { tokens } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, segments.findIndex((s) => s.value === selected));
  const segmentWidth = width / segments.length;
  const position = useState(() => new Animated.Value(index))[0];

  useEffect(() => {
    Animated.spring(position, { toValue: index, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
  }, [index, position]);

  return (
    <GlassView radius={24} blur={false} style={{ padding: 4 }}>
      <View style={{ height: 42, flexDirection: 'row' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: segmentWidth,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: tokens.borderHighlight,
              backgroundColor: tokens.scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)',
              transform: [{ translateX: Animated.multiply(position, segmentWidth) }],
            }}
          />
        ) : null}
        {segments.map((segment, i) => (
          <Pressable
            key={String(segment.value)}
            onPress={() => {
              tap();
              onChange(segment.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: i === index }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {segment.icon ? (
              <Icon name={segment.icon} size={16} color={i === index ? tokens.accent : tokens.textMuted} />
            ) : null}
            <Txt variant="label" numberOfLines={1} color={i === index ? tokens.textPrimary : tokens.textSecondary} style={{ fontSize: 13 }}>
              {segment.label}
            </Txt>
          </Pressable>
        ))}
      </View>
    </GlassView>
  );
}
