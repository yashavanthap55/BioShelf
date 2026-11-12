import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  statusLabel,
  STOCK_LABEL,
  type AssetCategory,
  type ExpiryStatus,
  type MedicalAsset,
  type StockStatus,
} from '@/domain/entities';
import { useServices } from '../hooks/useAppServices';
import { CATEGORY_ICON, categoryColor } from '../theme/categoryStyle';
import { useTheme } from '../theme/ThemeProvider';
import { statusColor, stockColor, withAlpha } from '../theme/tokens';
import { Icon } from './Icon';
import { Txt } from './Txt';

/** Hairline-outlined status pill with a small colour dot. */
function Pill({ color, label, compact }: { color: string; label: string; compact?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: compact ? 5 : 6,
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 3 : 5,
        borderRadius: 999,
        borderWidth: 0.8,
        borderColor: withAlpha(color, 0.35),
        backgroundColor: withAlpha(color, 0.07),
      }}
    >
      <View style={{ width: compact ? 5 : 6, height: compact ? 5 : 6, borderRadius: 3, backgroundColor: color }} />
      <Txt variant="labelMedium" color={color} numberOfLines={1} style={{ fontSize: compact ? 10.5 : 12, letterSpacing: 0.3 }}>
        {label}
      </Txt>
    </View>
  );
}

export function StatusPill({ status, category, compact }: { status: ExpiryStatus; category: AssetCategory; compact?: boolean }) {
  const { tokens } = useTheme();
  return <Pill color={statusColor(tokens, status)} label={statusLabel(status, category)} compact={compact} />;
}

export function StockPill({ status, compact }: { status: StockStatus; compact?: boolean }) {
  const { tokens } = useTheme();
  const label = compact ? (status === 'outOfStock' ? 'Out' : 'Low') : STOCK_LABEL[status];
  return <Pill color={stockColor(tokens, status)} label={label} compact={compact} />;
}

/** Category glyph in a quiet glass disc. */
export function CategoryAvatar({ category, size = 48 }: { category: AssetCategory; size?: number }) {
  const { tokens } = useTheme();
  const color = categoryColor(category, tokens.scheme);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: tokens.borderHighlight,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LinearGradient
        colors={[withAlpha(color, 0.14), withAlpha(color, 0.04)]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Icon name={CATEGORY_ICON[category]} size={size * 0.44} color={color} />
    </View>
  );
}

/** Resolves a stored photo reference to a displayable URI. */
export function usePhotoUri(reference: string | null): string | null {
  const { images } = useServices();
  const [resolved, setResolved] = useState<{ ref: string; uri: string | null } | null>(null);
  useEffect(() => {
    if (!reference) return;
    let alive = true;
    images.resolve(reference).then(
      (uri) => alive && setResolved({ ref: reference, uri }),
      () => alive && setResolved({ ref: reference, uri: null }),
    );
    return () => {
      alive = false;
    };
  }, [images, reference]);
  return reference && resolved?.ref === reference ? resolved.uri : null;
}

/** The asset's label photo in a round frame, or its category glyph. */
export function AssetAvatar({ asset, size = 48 }: { asset: MedicalAsset; size?: number }) {
  const { tokens } = useTheme();
  const uri = usePhotoUri(asset.imageRef);
  if (!uri) return <CategoryAvatar category={asset.category} size={size} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: 1, borderColor: tokens.borderHighlight }}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={250} />
    </View>
  );
}
