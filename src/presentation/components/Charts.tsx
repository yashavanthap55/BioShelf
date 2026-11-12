import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { MonthlyExpiryBucket } from '@/domain/stats';
import { useEntrance } from '../hooks/motion';
import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../theme/tokens';
import { formatMonth } from '../utils/formatters';
import { Txt } from './Txt';

export interface RingSegment {
  value: number;
  color: string;
}

/** Animated donut chart drawn with fine, round-capped strokes. */
export function RingChart({
  segments,
  size,
  strokeWidth = 5,
  maxValue,
  children,
  accessibilityLabel,
}: {
  segments: readonly RingSegment[];
  size: number;
  strokeWidth?: number;
  maxValue?: number;
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const { tokens } = useTheme();
  const progress = useEntrance(1200);
  const radius = size / 2 - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const visible = segments.filter((s) => s.value > 0);
  const total = maxValue ?? visible.reduce((sum, s) => sum + s.value, 0);
  // Round caps overhang each end by half the stroke, so leave a full stroke
  // (plus a hair) between segments.
  const gap = visible.length > 1 ? strokeWidth + 6 : 0;
  const drawn = circumference * progress;

  const lengths = visible.map((s) => (total > 0 ? (s.value / total) * circumference : 0));
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((sum, l) => sum + l, 0));
  const arcs = visible.map((segment, i) => {
    const full = lengths[i];
    const start = starts[i];
    const length = Math.max(0.5, Math.min(full - gap, drawn - start));
    if (start >= drawn || length <= 0) return null;
    return (
      <Circle
        key={i}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={segment.color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${length} ${circumference}`}
        strokeDashoffset={-(start + gap / 2)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    );
  });

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={withAlpha(tokens.textMuted, 0.25)} strokeWidth={1} />
        {arcs}
      </Svg>
      {children}
    </View>
  );
}

/** Fine progress line (shelf life elapsed, category share, ...). */
export function ProgressLine({ value, color, height = 3 }: { value: number; color: string; height?: number }) {
  const { tokens } = useTheme();
  const progress = useEntrance(900, value);
  const width = Math.max(0.02, Math.min(1, value)) * progress;
  return (
    <View style={{ height, borderRadius: height, backgroundColor: withAlpha(tokens.textMuted, 0.18), overflow: 'hidden' }}>
      <View style={{ height, width: `${width * 100}%`, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

const MAX_BAR = 96;

/** Slim bars: how many items expire in each of the coming months. */
export function ExpiryOutlookChart({ buckets, overdue }: { buckets: readonly MonthlyExpiryBucket[]; overdue: number }) {
  const { tokens } = useTheme();
  const progress = useEntrance(900);
  const bars = [
    ...(overdue > 0 ? [{ label: 'Past', count: overdue, color: tokens.expired }] : []),
    ...buckets.map((b) => ({ label: formatMonth(b.month), count: b.count, color: tokens.accent })),
  ];
  const peak = Math.max(1, ...bars.map((b) => b.count));
  return (
    <View
      accessible
      accessibilityLabel={`Expiry outlook: ${bars.map((b) => `${b.label} ${b.count}`).join(', ')}`}
      style={{ height: 160, flexDirection: 'row', alignItems: 'flex-end' }}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 27, height: 1, backgroundColor: tokens.borderFaint }} />
      {bars.map((bar) => (
        <View key={bar.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
          <Txt variant="title" color={bar.count > 0 ? tokens.textPrimary : tokens.textMuted} style={{ fontSize: 20, lineHeight: 24 }}>
            {bar.count}
          </Txt>
          <View
            style={{
              marginTop: 6,
              width: 10,
              height: Math.max(3, MAX_BAR * (bar.count / peak) * progress),
              borderRadius: 5,
              backgroundColor: bar.count > 0 ? withAlpha(bar.color, 0.9) : withAlpha(tokens.textMuted, 0.2),
            }}
          />
          <Txt variant="eyebrow" style={{ marginTop: 10, letterSpacing: 1.2 }}>
            {bar.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}
