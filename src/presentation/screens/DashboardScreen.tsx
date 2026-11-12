import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORY_INFO, type AssetCategory } from '@/domain/entities';
import type { AssetInsight } from '@/domain/evaluator';
import type { StatusFilter } from '@/domain/specifications';
import type { InventoryStats } from '@/domain/stats';
import { openAsset } from '../components/AssetCard';
import { AssetAvatar, CategoryAvatar } from '../components/Badges';
import { ExpiryOutlookChart, ProgressLine, RingChart } from '../components/Charts';
import { ActivityRow, EmptyState, FadeIn, SectionHeader, StatTile, stagger } from '../components/Common';
import { GlassView } from '../components/glass/GlassView';
import { TAB_BAR_HEIGHT } from '../components/GlassTabBar';
import { Txt } from '../components/Txt';
import { useInventory, useSettings } from '../hooks/useAppServices';
import { categoryColor } from '../theme/categoryStyle';
import { useTheme } from '../theme/ThemeProvider';
import { statusColor } from '../theme/tokens';
import { compactDays, countdownSentence, formatWeekday, greetingFor } from '../utils/formatters';

export function DashboardScreen() {
  const { vm, state } = useInventory();
  const { state: settings } = useSettings();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const now = new Date();
  const { stats } = state;

  if (state.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.accent} />
      </View>
    );
  }

  const openFiltered = (filter: StatusFilter) => {
    vm.showOnly(filter);
    router.navigate('/inventory');
  };

  const header = (
    <FadeIn>
      <View style={{ flexDirection: 'row', paddingHorizontal: 4 }}>
        <Txt variant="eyebrow" style={{ flex: 1 }}>
          {greetingFor(now)}
        </Txt>
        <Txt variant="eyebrow">{formatWeekday(now)}</Txt>
      </View>
      <Txt variant="headlineLarge" numberOfLines={2} style={{ marginTop: 10, paddingHorizontal: 4 }}>
        {settings.facilityName}
      </Txt>
    </FadeIn>
  );

  const padding = { paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 48 };

  if (stats.total === 0) {
    return (
      <ScrollView contentContainerStyle={padding}>
        {header}
        <View style={{ height: 60 }} />
        <EmptyState
          icon="inventory-2"
          title="Your shelf is empty"
          message="Add medicines, vaccines, reagents or equipment to start tracking expiry dates and stock levels."
          actionLabel="Add first asset"
          onAction={() => router.push('/asset-form')}
        />
      </ScrollView>
    );
  }

  const categories = (Object.entries(stats.byCategory) as [AssetCategory, number][]).sort((a, b) => b[1] - a[1]);
  const upcoming = vm.expiringNext();

  return (
    <ScrollView
      contentContainerStyle={padding}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={tokens.accent}
          colors={[tokens.accent]}
          progressViewOffset={insets.top}
          onRefresh={async () => {
            setRefreshing(true);
            await vm.refresh();
            setRefreshing(false);
          }}
        />
      }
    >
      {header}
      <FadeIn delay={60} style={{ marginTop: 28 }}>
        <HealthCard stats={stats} />
      </FadeIn>
      <FadeIn delay={120} style={{ marginTop: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <StatTile label="Expired" value={stats.expired} color={tokens.expired} caption="Dispose safely" onPress={() => openFiltered('expired')} />
          <StatTile label="Critical" value={stats.critical} color={tokens.critical} caption="Use or return first" onPress={() => openFiltered('critical')} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <StatTile label="Expiring soon" value={stats.warning} color={tokens.warning} caption="Plan usage (FEFO)" onPress={() => openFiltered('expiringSoon')} />
          <StatTile label="Low stock" value={stats.lowStock} color={tokens.lowStock} caption={`${stats.outOfStock} out of stock`} onPress={() => openFiltered('lowStock')} />
        </View>
      </FadeIn>

      <View style={{ marginTop: 36 }}>
        <SectionHeader
          title="Expiring next"
          actionLabel="See all"
          onAction={() => {
            vm.clearFilters();
            router.navigate('/inventory');
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        >
          {upcoming.map((insight, i) => (
            <FadeIn key={insight.asset.id} delay={stagger(i, 60)}>
              <UpcomingCard insight={insight} />
            </FadeIn>
          ))}
        </ScrollView>
      </View>

      <View style={{ marginTop: 36 }}>
        <SectionHeader title="Expiry outlook" />
        <GlassView style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 }}>
          <Txt variant="bodySmall">Items reaching their expiry or service date, by month</Txt>
          <View style={{ marginTop: 18 }}>
            <ExpiryOutlookChart buckets={stats.outlook} overdue={stats.expired} />
          </View>
        </GlassView>
      </View>

      <View style={{ marginTop: 36 }}>
        <SectionHeader title="By category" />
        <GlassView style={{ paddingVertical: 8 }}>
          {categories.map(([category, count]) => (
            <CategoryRow
              key={category}
              category={category}
              count={count}
              share={count / stats.total}
              onPress={() => {
                vm.clearFilters();
                vm.setCategory(category);
                router.navigate('/inventory');
              }}
            />
          ))}
        </GlassView>
      </View>

      <View style={{ marginTop: 36 }}>
        <SectionHeader title="Recent activity" />
        <GlassView style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
          {state.recentActivity.length === 0 ? (
            <Txt variant="bodySmall" style={{ paddingVertical: 12 }}>
              No activity yet
            </Txt>
          ) : (
            state.recentActivity.slice(0, 6).map((entry) => <ActivityRow key={entry.id ?? entry.timestamp} entry={entry} now={now} />)
          )}
        </GlassView>
      </View>
    </ScrollView>
  );
}

function HealthCard({ stats }: { stats: InventoryStats }) {
  const { tokens } = useTheme();
  const percent = Math.round(stats.healthScore * 100);
  const legend = [
    { color: tokens.safe, label: 'Safe', count: stats.safe },
    { color: tokens.warning, label: 'Expiring soon', count: stats.warning },
    { color: tokens.critical, label: 'Critical', count: stats.critical },
    { color: tokens.expired, label: 'Expired', count: stats.expired },
  ];
  return (
    <GlassView radius={28} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 22, paddingLeft: 20, paddingRight: 22, gap: 20 }}>
      <RingChart
        size={126}
        accessibilityLabel={`Shelf health ${percent} percent`}
        segments={[
          { value: stats.safe, color: tokens.safe },
          { value: stats.warning, color: tokens.warning },
          { value: stats.critical, color: tokens.critical },
          { value: stats.expired, color: tokens.expired },
        ]}
      >
        <Txt variant="display">{percent}%</Txt>
        <Txt variant="eyebrow">Health</Txt>
      </RingChart>
      <View style={{ flex: 1 }}>
        <Txt variant="title">Shelf health</Txt>
        <Txt variant="bodySmall" style={{ marginTop: 4 }}>
          {stats.safe} of {stats.total} items are clear of alerts
        </Txt>
        <View style={{ marginTop: 14, gap: 6 }}>
          {legend.map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.color }} />
              <Txt variant="bodySmall" numberOfLines={1} style={{ flex: 1 }}>
                {item.label}
              </Txt>
              <Txt variant="label">{item.count}</Txt>
            </View>
          ))}
        </View>
      </View>
    </GlassView>
  );
}

function UpcomingCard({ insight }: { insight: AssetInsight }) {
  const { tokens } = useTheme();
  const { asset } = insight;
  const color = statusColor(tokens, insight.status);
  return (
    <GlassView
      radius={24}
      blur={false}
      onPress={() => openAsset(asset.id)}
      accessibilityLabel={`${asset.name}, ${countdownSentence(insight.daysRemaining, asset.category)}`}
      style={{ width: 164, height: 176, padding: 16 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <AssetAvatar asset={asset} size={36} />
        <View style={{ flex: 1 }} />
        <Txt variant="title" color={color} style={{ fontSize: 22, lineHeight: 26 }}>
          {compactDays(insight.daysRemaining)}
        </Txt>
      </View>
      <View style={{ flex: 1 }} />
      <Txt variant="titleSmall" numberOfLines={2}>
        {asset.name}
      </Txt>
      <Txt variant="bodySmall" numberOfLines={1} style={{ marginTop: 4 }}>
        {countdownSentence(insight.daysRemaining, asset.category)}
      </Txt>
      <View style={{ marginTop: 12 }}>
        <ProgressLine value={insight.shelfLifeUsed} color={color} />
      </View>
    </GlassView>
  );
}

function CategoryRow({ category, count, share, onPress }: { category: AssetCategory; count: number; share: number; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${CATEGORY_INFO[category].label}: ${count}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 18,
        paddingVertical: 10,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <CategoryAvatar category={category} size={34} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt variant="titleSmall" style={{ flex: 1 }}>
            {CATEGORY_INFO[category].label}
          </Txt>
          <Txt variant="label">{count}</Txt>
        </View>
        <View style={{ marginTop: 8 }}>
          <ProgressLine value={share} color={categoryColor(category, tokens.scheme)} height={2} />
        </View>
      </View>
    </Pressable>
  );
}
