import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ExpiryStatus } from '@/domain/entities';
import type { AssetInsight } from '@/domain/evaluator';
import { AssetCard } from '../components/AssetCard';
import { EmptyState, FadeIn, ScreenHeader, stagger } from '../components/Common';
import { IconButton } from '../components/glass/Controls';
import { GlassView } from '../components/glass/GlassView';
import { TAB_BAR_HEIGHT } from '../components/GlassTabBar';
import { Txt } from '../components/Txt';
import { useInventory } from '../hooks/useAppServices';
import { useTheme } from '../theme/ThemeProvider';
import { statusColor } from '../theme/tokens';
import { useStockActions } from './stockActions';

const SECTIONS: { status: ExpiryStatus; title: string; hint: string }[] = [
  { status: 'expired', title: 'Expired & overdue', hint: 'Quarantine and dispose per biomedical waste rules.' },
  { status: 'critical', title: 'Critical', hint: 'Inside the critical window: use first, transfer or return.' },
  { status: 'warning', title: 'Expiring soon', hint: 'Plan usage with first-expiry, first-out.' },
];

function SectionTitle({ color, title, hint, count }: { color: string; title: string; hint: string; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
      <View style={{ marginTop: 11, width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <View style={{ flex: 1 }}>
        <Txt variant="title">
          {title} · {count}
        </Txt>
        <Txt variant="bodySmall" style={{ marginTop: 2 }}>
          {hint}
        </Txt>
      </View>
    </View>
  );
}

export function AlertsScreen() {
  const { vm, state } = useInventory();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const actions = useStockActions();
  const { stats } = state;

  const sections = SECTIONS.map((s) => ({ ...s, items: vm.withStatus(s.status) }));
  const lowStock = vm.lowStock();
  const allClear = sections.every((s) => s.items.length === 0) && lowStock.length === 0;

  const summary = [
    { label: 'Expired', count: stats.expired, color: tokens.expired },
    { label: 'Critical', count: stats.critical, color: tokens.critical },
    { label: 'Soon', count: stats.warning, color: tokens.warning },
    { label: 'Low stock', count: stats.lowStock, color: tokens.lowStock },
  ];

  const renderList = (items: AssetInsight[], trailing: (insight: AssetInsight) => React.ReactNode) =>
    items.map((insight, i) => (
      <FadeIn key={insight.asset.id} delay={stagger(i)} style={{ marginBottom: 10 }}>
        <AssetCard insight={insight} trailing={trailing(insight)} />
      </FadeIn>
    ));

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 48 }}>
      <ScreenHeader
        eyebrow="Action centre"
        title="Alerts"
        subtitle={allClear ? 'Nothing needs your attention' : `${stats.attention} items need attention now`}
      />
      <GlassView radius={24} style={{ marginTop: 20, flexDirection: 'row', paddingVertical: 18, paddingHorizontal: 8 }}>
        {summary.map((item) => (
          <View key={item.label} accessible accessibilityLabel={`${item.label}: ${item.count}`} style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="headlineLarge">{item.count}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color }} />
              <Txt variant="labelMedium" numberOfLines={1}>
                {item.label}
              </Txt>
            </View>
          </View>
        ))}
      </GlassView>

      {allClear ? (
        <View style={{ marginTop: 48 }}>
          <EmptyState icon="verified" title="All clear" message="No expired, expiring or low-stock items. Nice shelf!" />
        </View>
      ) : null}

      {sections.map((section) =>
        section.items.length === 0 ? null : (
          <View key={section.status} style={{ marginTop: 28 }}>
            <SectionTitle color={statusColor(tokens, section.status)} title={section.title} hint={section.hint} count={section.items.length} />
            {renderList(section.items, (insight) =>
              section.status === 'expired' ? (
                <IconButton icon="recycling" label="Dispose" color={tokens.expired} size={40} blur={false} onPress={() => void actions.dispose(insight.asset)} />
              ) : null,
            )}
          </View>
        ),
      )}

      {lowStock.length > 0 ? (
        <View style={{ marginTop: 28 }}>
          <SectionTitle color={tokens.lowStock} title="Low & out of stock" hint="At or below the reorder level. Restock or raise a PO." count={lowStock.length} />
          {renderList(lowStock, (insight) => (
            <IconButton icon="add-shopping-cart" label="Restock" color={tokens.lowStock} size={40} blur={false} onPress={() => void actions.adjust(insight.asset, true)} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
