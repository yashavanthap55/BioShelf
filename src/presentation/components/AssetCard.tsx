import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { AssetInsight } from '@/domain/evaluator';
import { useTheme } from '../theme/ThemeProvider';
import { statusColor } from '../theme/tokens';
import { compactDays } from '../utils/formatters';
import { AssetAvatar, StatusPill, StockPill } from './Badges';
import { ProgressLine } from './Charts';
import { GlassView } from './glass/GlassView';
import { Txt } from './Txt';

export const openAsset = (id: string) => router.push({ pathname: '/asset/[id]', params: { id } });

/** Glass row summarising one asset: identity, countdown, status and stock. */
export function AssetCard({ insight, trailing }: { insight: AssetInsight; trailing?: ReactNode }) {
  const { tokens } = useTheme();
  const { asset } = insight;
  const color = statusColor(tokens, insight.status);
  return (
    <GlassView radius={22} blur={false} style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* A sibling of `trailing`, which may hold its own button: on the web a Pressable is a <button>, and buttons can't nest. */}
      <Pressable
        onPress={() => openAsset(asset.id)}
        accessibilityRole="button"
        accessibilityLabel={`${asset.name}, ${insight.status}, ${asset.quantity} ${asset.unit}`}
        testID={`asset-${asset.id}`}
        style={({ pressed }) => [
          { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
          pressed && { opacity: 0.85 },
        ]}
      >
        <AssetAvatar asset={asset} size={50} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt variant="titleSmall" numberOfLines={1} style={{ flex: 1, fontSize: 15 }}>
              {asset.name}
            </Txt>
            <Txt variant="label" color={color}>
              {compactDays(insight.daysRemaining)}
            </Txt>
          </View>
          <Txt variant="bodySmall" numberOfLines={1} style={{ marginTop: 2 }}>
            {asset.batchNumber} · {asset.location}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <StatusPill status={insight.status} category={asset.category} compact />
              {insight.isLowStock ? <StockPill status={insight.stockStatus} compact /> : null}
            </View>
            <Txt variant="labelMedium" numberOfLines={1}>
              {asset.quantity} {asset.unit}
            </Txt>
          </View>
          <View style={{ marginTop: 10 }}>
            <ProgressLine value={insight.shelfLifeUsed} color={color} height={2} />
          </View>
        </View>
      </Pressable>
      {trailing ? <View style={{ paddingRight: 14 }}>{trailing}</View> : null}
    </GlassView>
  );
}
