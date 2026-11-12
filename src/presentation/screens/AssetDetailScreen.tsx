import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORY_INFO, dateLabelFor, STORAGE_INFO, tracksServiceDate, type ActivityEntry } from '@/domain/entities';
import type { AssetInsight } from '@/domain/evaluator';
import { AssetAvatar, StatusPill, StockPill, usePhotoUri } from '../components/Badges';
import { ProgressLine, RingChart } from '../components/Charts';
import { ActivityRow, EmptyState, FadeIn, SectionHeader } from '../components/Common';
import { useDialogs } from '../components/feedback/Dialogs';
import { useToast } from '../components/feedback/Toast';
import { IconButton, PrimaryButton, SecondaryButton } from '../components/glass/Controls';
import { GlassView } from '../components/glass/GlassView';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { useInventory } from '../hooks/useAppServices';
import { categoryColor, STORAGE_ICON, type IconName } from '../theme/categoryStyle';
import { useTheme } from '../theme/ThemeProvider';
import { statusColor } from '../theme/tokens';
import { countdownSentence, formatDate } from '../utils/formatters';
import { useStockActions } from './stockActions';

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

export function AssetDetailScreen({ id }: { id: string }) {
  const { vm, state } = useInventory();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const dialogs = useDialogs();
  const toast = useToast();
  const actions = useStockActions();
  const insight = state.insights.find((i) => i.asset.id === id);
  const current = insight?.asset;
  const [history, setHistory] = useState<ActivityEntry[] | null>(null);

  // Reload the audit trail whenever the asset itself changes.
  useEffect(() => {
    let alive = true;
    if (current) vm.activityFor(id).then((entries) => alive && setHistory(entries));
    return () => {
      alive = false;
    };
  }, [vm, id, current]);

  if (!insight) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState icon="inventory-2" title="Asset not found" message="This item is no longer in the inventory." actionLabel="Go back" onAction={goBack} />
      </View>
    );
  }

  const { asset } = insight;
  const expired = insight.status === 'expired';

  const remove = async (disposal: boolean) => {
    if (disposal) {
      goBack();
      await actions.dispose(asset);
      return;
    }
    const ok = await dialogs.confirm({
      title: 'Delete this record?',
      message: `${asset.name} will be removed from the inventory. You can undo this.`,
      confirmLabel: 'Delete',
      icon: 'delete-outline',
      destructive: true,
    });
    if (!ok) return;
    goBack();
    await vm.deleteAsset(asset);
    toast.showUndo(`${asset.name} deleted`, () => void vm.undo());
  };

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <IconButton icon="arrow-back" label="Back" onPress={goBack} />
        <View style={{ flex: 1 }} />
        <IconButton icon="edit" label="Edit" onPress={() => router.push({ pathname: '/asset-form', params: { id } })} />
        <IconButton icon="delete-outline" label="Delete" color={tokens.expired} onPress={() => void remove(false)} />
      </View>

      <FadeIn style={{ marginTop: 20 }}>
        <HeroCard insight={insight} />
      </FadeIn>
      {asset.imageRef ? (
        <FadeIn delay={60} style={{ marginTop: 14 }}>
          <PhotoCard reference={asset.imageRef} onOpen={(uri) => void dialogs.viewPhoto(uri)} />
        </FadeIn>
      ) : null}

      <FadeIn delay={90} style={{ marginTop: 14 }}>
        <GlassView radius={26} style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="eyebrow">In stock</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <Txt variant="display">{asset.quantity}</Txt>
                <Txt variant="bodyLarge" color={tokens.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {asset.unit}
                </Txt>
              </View>
              <Txt variant="bodySmall">
                Reorder at {asset.reorderLevel} {asset.unit}
              </Txt>
            </View>
            <StockPill status={insight.stockStatus} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            <SecondaryButton label="Use" icon="remove" disabled={asset.quantity <= 0} onPress={() => void actions.adjust(asset, false)} style={{ flex: 1 }} />
            <PrimaryButton label="Restock" icon="add" onPress={() => void actions.adjust(asset, true)} style={{ flex: 1 }} />
          </View>
        </GlassView>
      </FadeIn>

      <InfoGrid insight={insight} />

      {asset.notes.trim() ? (
        <GlassView blur={false} style={{ marginTop: 14, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon name="sticky-note-2" size={18} color={tokens.accent} />
            <Txt variant="titleSmall">Handling notes</Txt>
          </View>
          <Txt variant="body">{asset.notes}</Txt>
        </GlassView>
      ) : null}

      <View style={{ marginTop: 26 }}>
        <SectionHeader title="Audit trail" />
        <GlassView blur={false} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          {history === null ? (
            <Txt variant="bodySmall" style={{ paddingVertical: 12 }}>
              Loading…
            </Txt>
          ) : history.length === 0 ? (
            <Txt variant="bodySmall" style={{ paddingVertical: 12 }}>
              No changes recorded for this item yet
            </Txt>
          ) : (
            history.map((entry) => <ActivityRow key={entry.id ?? entry.timestamp} entry={entry} now={new Date()} showAssetName={false} />)
          )}
        </GlassView>
      </View>

      {expired ? (
        <PrimaryButton
          label={tracksServiceDate(asset.category) ? 'Retire overdue equipment' : 'Dispose expired stock'}
          icon="recycling"
          destructive
          onPress={() => void remove(true)}
          style={{ marginTop: 24 }}
        />
      ) : null}
    </ScrollView>
  );
}

function HeroCard({ insight }: { insight: AssetInsight }) {
  const { tokens } = useTheme();
  const { asset, daysRemaining } = insight;
  const color = statusColor(tokens, insight.status);
  return (
    <GlassView radius={30} style={{ padding: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <AssetAvatar asset={asset} size={64} />
        <View style={{ flex: 1 }}>
          <Txt variant="eyebrow" color={categoryColor(asset.category, tokens.scheme)}>
            {CATEGORY_INFO[asset.category].label}
          </Txt>
          <Txt variant="headlineSmall" style={{ marginTop: 4 }}>
            {asset.name}
          </Txt>
          <Txt variant="bodySmall" style={{ marginTop: 4 }}>
            {asset.manufacturer}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 24 }}>
        <RingChart size={118} strokeWidth={4} maxValue={1} segments={[{ value: 1 - insight.shelfLifeUsed, color }]} accessibilityLabel={countdownSentence(daysRemaining, asset.category)}>
          <Txt variant="headline" color={color}>
            {Math.abs(daysRemaining)}
          </Txt>
          <Txt variant="eyebrow">{daysRemaining < 0 ? 'Days ago' : 'Days left'}</Txt>
        </RingChart>
        <View style={{ flex: 1 }}>
          <StatusPill status={insight.status} category={asset.category} />
          <Txt variant="titleMedium" style={{ marginTop: 10 }}>
            {countdownSentence(daysRemaining, asset.category)}
          </Txt>
          <Txt variant="bodySmall" style={{ marginTop: 2 }}>
            {dateLabelFor(asset.category)}: {formatDate(asset.expiryDate)}
          </Txt>
          <View style={{ marginTop: 14 }}>
            <ProgressLine value={insight.shelfLifeUsed} color={color} />
          </View>
          <Txt variant="labelMedium" style={{ marginTop: 6 }}>
            {Math.round(insight.shelfLifeUsed * 100)}% of {tracksServiceDate(asset.category) ? 'service interval' : 'shelf life'} used
          </Txt>
        </View>
      </View>
    </GlassView>
  );
}

function PhotoCard({ reference, onOpen }: { reference: string; onOpen: (uri: string) => void }) {
  const uri = usePhotoUri(reference);
  return (
    <GlassView radius={28} style={{ padding: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Label photo. Tap to enlarge" disabled={!uri} onPress={() => uri && onOpen(uri)} style={{ borderRadius: 21, overflow: 'hidden', aspectRatio: 4 / 3 }}>
        {uri ? <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={250} /> : null}
        <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Icon name="open-in-full" size={13} color="#FFFFFF" />
          <Txt variant="eyebrow" color="#FFFFFF" style={{ fontSize: 9.5 }}>
            Label photo
          </Txt>
        </View>
      </Pressable>
    </GlassView>
  );
}

function InfoGrid({ insight }: { insight: AssetInsight }) {
  const { asset, policy } = insight;
  const service = tracksServiceDate(asset.category);
  const tiles: { icon: IconName; label: string; value: string }[] = [
    { icon: 'qr-code-2', label: service ? 'Serial no.' : 'Batch / lot', value: asset.batchNumber },
    { icon: 'place', label: 'Location', value: asset.location },
    { icon: STORAGE_ICON[asset.storage], label: 'Storage', value: `${STORAGE_INFO[asset.storage].label}\n${STORAGE_INFO[asset.storage].range}` },
    {
      icon: 'precision-manufacturing',
      label: service ? 'Last serviced' : 'Manufactured',
      value: asset.manufactureDate ? formatDate(asset.manufactureDate) : 'Not recorded',
    },
    { icon: 'event', label: dateLabelFor(asset.category), value: formatDate(asset.expiryDate) },
    { icon: 'shield', label: 'Alert policy', value: `${policy.name}\nWarn ${policy.warningWindowDays}d · critical ${policy.criticalWindowDays}d` },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
      {tiles.map((tile) => (
        <InfoTile key={tile.label} {...tile} />
      ))}
    </View>
  );
}

function InfoTile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <GlassView blur={false} radius={20} style={{ flexBasis: '47%', flexGrow: 1, minHeight: 116, padding: 14, justifyContent: 'space-between' }}>
      <Icon name={icon} size={20} color={tokens.accent} />
      <View style={{ marginTop: 14 }}>
        <Txt variant="eyebrow">{label}</Txt>
        <Txt variant="titleSmall" numberOfLines={3} style={{ marginTop: 4, fontSize: 13, lineHeight: 17 }}>
          {value}
        </Txt>
      </View>
    </GlassView>
  );
}
