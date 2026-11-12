import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ASSET_CATEGORIES, CATEGORY_INFO } from '@/domain/entities';
import { SORT_OPTION_KEYS, SORT_OPTIONS } from '@/domain/sorting';
import { STATUS_FILTER_LABEL, STATUS_FILTERS, type StatusFilter } from '@/domain/specifications';
import { AssetCard } from '../components/AssetCard';
import { EmptyState, FadeIn, ScreenHeader, stagger } from '../components/Common';
import { useDialogs } from '../components/feedback/Dialogs';
import { useToast } from '../components/feedback/Toast';
import { Chip, IconButton, TextButton } from '../components/glass/Controls';
import { TAB_BAR_HEIGHT } from '../components/GlassTabBar';
import { Icon } from '../components/Icon';
import { TextField } from '../components/TextField';
import { Txt } from '../components/Txt';
import { useInventory } from '../hooks/useAppServices';
import { CATEGORY_ICON, categoryColor } from '../theme/categoryStyle';
import { useTheme } from '../theme/ThemeProvider';
import type { GlassTokens } from '../theme/tokens';

const filterColor = (t: GlassTokens, filter: StatusFilter) =>
  ({
    all: t.accent,
    expired: t.expired,
    critical: t.critical,
    expiringSoon: t.warning,
    safe: t.safe,
    lowStock: t.lowStock,
    coldChain: t.accent,
  })[filter];

export function InventoryScreen() {
  const { vm, state } = useInventory();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const dialogs = useDialogs();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const { filter } = state;

  const undo = async () => {
    const done = await vm.undo();
    if (done) toast.show(`Undid: ${done}`);
  };
  const redo = async () => {
    const done = await vm.redo();
    if (done) toast.show(`Redid: ${done}`);
  };

  const openSort = () =>
    dialogs.sheet<void>(
      (close) => (
        <View>
          <Txt variant="title" style={{ marginBottom: 10, marginLeft: 4 }}>
            Sort inventory
          </Txt>
          {SORT_OPTION_KEYS.map((option) => {
            const selected = state.sort === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  vm.setSort(option);
                  close();
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}
              >
                <Icon name={selected ? 'radio-button-checked' : 'radio-button-unchecked'} color={selected ? tokens.accent : tokens.textMuted} />
                <View style={{ flex: 1 }}>
                  <Txt variant="titleSmall">{SORT_OPTIONS[option].label}</Txt>
                  <Txt variant="bodySmall">{SORT_OPTIONS[option].description}</Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
      ),
      undefined,
    );

  const chipRow = { paddingHorizontal: 20, gap: 8, alignItems: 'center' as const };
  // ScrollView defaults to flexShrink: 1, so a long list below would squash the rows.
  const chipScroller = { flexGrow: 0, flexShrink: 0 };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20 }}>
        <ScreenHeader
          eyebrow={`${state.stats.total} items on shelf`}
          title="Inventory"
          actions={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton icon="undo" label={state.undoLabel ? `Undo: ${state.undoLabel}` : 'Undo'} disabled={!state.canUndo} onPress={undo} />
              <IconButton icon="redo" label={state.redoLabel ? `Redo: ${state.redoLabel}` : 'Redo'} disabled={!state.canRedo} onPress={redo} />
              <IconButton icon="swap-vert" label="Sort" onPress={openSort} />
            </View>
          }
        />
        <View style={{ marginTop: 18 }}>
          <TextField
            value={filter.query}
            onChangeText={(value) => vm.setQuery(value)}
            placeholder="Search name, batch, maker, location"
            icon="search"
            blur
            autoCapitalize="none"
            returnKeyType="search"
            testID="inventory-search"
            trailing={
              filter.query ? (
                <Pressable accessibilityLabel="Clear search" onPress={() => vm.setQuery('')} hitSlop={10} style={{ padding: 6 }}>
                  <Icon name="close" size={18} color={tokens.textSecondary} />
                </Pressable>
              ) : null
            }
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[chipScroller, { marginTop: 12 }]} contentContainerStyle={chipRow}>
        <Chip label="All" icon="apps" selected={filter.category === null} onPress={() => vm.setCategory(null)} />
        {ASSET_CATEGORIES.map((category) => (
          <Chip
            key={category}
            label={CATEGORY_INFO[category].label}
            icon={CATEGORY_ICON[category]}
            color={categoryColor(category, tokens.scheme)}
            selected={filter.category === category}
            onPress={() => vm.setCategory(filter.category === category ? null : category)}
          />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[chipScroller, { marginTop: 8 }]} contentContainerStyle={chipRow}>
        {STATUS_FILTERS.map((status) => (
          <Chip
            key={status}
            label={STATUS_FILTER_LABEL[status]}
            color={filterColor(tokens, status)}
            count={status === 'all' ? undefined : vm.countFor(status)}
            selected={filter.status === status}
            onPress={() => vm.setStatusFilter(status)}
          />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 22, paddingRight: 18, paddingTop: 10, paddingBottom: 4, minHeight: 40 }}>
        <Txt variant="labelMedium" numberOfLines={1} style={{ flex: 1 }}>
          {state.visible.length} shown · {SORT_OPTIONS[state.sort].label}
        </Txt>
        {filter.isActive ? <TextButton label="Clear" onPress={() => vm.clearFilters()} /> : null}
      </View>

      <FlatList
        data={state.visible}
        keyExtractor={(item) => item.asset.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 48, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={tokens.accent}
            colors={[tokens.accent]}
            onRefresh={async () => {
              setRefreshing(true);
              await vm.refresh();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item, index }) =>
          index < 10 ? (
            <FadeIn delay={stagger(index)}>
              <AssetCard insight={item} />
            </FadeIn>
          ) : (
            <AssetCard insight={item} />
          )
        }
        ListEmptyComponent={
          state.stats.total === 0 ? (
            <EmptyState icon="inventory-2" title="No assets yet" message="Tap the + button to add your first item." />
          ) : (
            <EmptyState
              icon="search-off"
              title="No matches"
              message="Nothing on the shelf matches these filters."
              actionLabel="Clear filters"
              onAction={() => vm.clearFilters()}
            />
          )
        }
      />
    </View>
  );
}
