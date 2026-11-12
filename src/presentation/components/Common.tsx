import { useEffect, type ReactNode, useState } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ActivityEntry } from '@/domain/entities';
import { useEntrance, useReducedMotion } from '../hooks/motion';
import { ACTIVITY_ICON, type IconName } from '../theme/categoryStyle';
import { useTheme } from '../theme/ThemeProvider';
import { timeAgo } from '../utils/formatters';
import { PrimaryButton, TextButton } from './glass/Controls';
import { GlassView } from './glass/GlassView';
import { Icon } from './Icon';
import { Txt } from './Txt';

/** Large serif title block at the top of each tab. */
export function ScreenHeader({
  title,
  eyebrow,
  subtitle,
  actions,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Txt variant="eyebrow" style={{ marginBottom: 6 }}>
            {eyebrow}
          </Txt>
        ) : null}
        <Txt variant="headline" numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="body" color={tokens.textSecondary} style={{ marginTop: 4 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {actions}
    </View>
  );
}

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Txt variant="title" style={{ flex: 1 }}>
        {title}
      </Txt>
      {actionLabel && onAction ? <TextButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function GroupLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4, marginBottom: 10, gap: 8 }}>
      <Txt variant="eyebrow">{children}</Txt>
      {right}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 24 }}>
      <GlassView radius={44} style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={34} color={tokens.accent} />
      </GlassView>
      <Txt variant="title" style={{ marginTop: 22, textAlign: 'center' }}>
        {title}
      </Txt>
      <Txt variant="body" color={tokens.textSecondary} style={{ marginTop: 8, textAlign: 'center' }}>
        {message}
      </Txt>
      {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} style={{ marginTop: 22, alignSelf: 'center', minWidth: 200 }} /> : null}
    </View>
  );
}

/** Entrance animation: fades and slides its child up after [delay] ms. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const value = useState(() => new Animated.Value(reduced ? 1 : 0))[0];
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    const animation = Animated.timing(value, { toValue: 1, duration: 520, delay, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [delay, reduced, value]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export const stagger = (index: number, step = 45, max = 8) => step * Math.min(index, max);

/** Number that counts up to [value]. */
export function CountUp({ value, variant = 'display' }: { value: number; variant?: 'display' | 'headline' | 'headlineLarge' }) {
  const progress = useEntrance(900, value);
  return <Txt variant={variant}>{Math.round(value * progress)}</Txt>;
}

/** Key figure tile: status dot + label, serif number, quiet caption. */
export function StatTile({
  label,
  value,
  color,
  caption,
  onPress,
}: {
  label: string;
  value: number;
  color: string;
  caption?: string;
  onPress?: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <GlassView
      radius={24}
      onPress={onPress}
      accessibilityLabel={`${label}: ${value}${caption ? `, ${caption}` : ''}`}
      style={{ flex: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
        <Txt variant="label" color={tokens.textSecondary} numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>
          {label}
        </Txt>
        {onPress ? <Icon name="arrow-outward" size={14} color={tokens.textMuted} /> : null}
      </View>
      <View style={{ marginTop: 8 }}>
        <CountUp value={value} />
      </View>
      {caption ? (
        <Txt variant="bodySmall" color={tokens.textMuted} numberOfLines={1} style={{ fontSize: 11.5 }}>
          {caption}
        </Txt>
      ) : null}
    </GlassView>
  );
}

export function ActivityRow({ entry, now, showAssetName = true }: { entry: ActivityEntry; now: Date; showAssetName?: boolean }) {
  const { tokens } = useTheme();
  const color =
    entry.type === 'added' || entry.type === 'restocked'
      ? tokens.safe
      : entry.type === 'deleted' || entry.type === 'disposed'
        ? tokens.expired
        : entry.type === 'consumed'
          ? tokens.warning
          : entry.type === 'reverted'
            ? tokens.lowStock
            : tokens.accent;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 12 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: tokens.borderHighlight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={ACTIVITY_ICON[entry.type]} size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        {showAssetName ? (
          <Txt variant="titleSmall" numberOfLines={1}>
            {entry.assetName}
          </Txt>
        ) : null}
        <Txt variant="bodySmall">{entry.message}</Txt>
      </View>
      <Txt variant="eyebrow" style={{ letterSpacing: 0.2, textTransform: 'none' }}>
        {timeAgo(entry.timestamp, now)}
      </Txt>
    </View>
  );
}
