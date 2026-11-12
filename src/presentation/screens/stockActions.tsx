import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { MedicalAsset } from '@/domain/entities';
import { useDialogs } from '../components/feedback/Dialogs';
import { useToast } from '../components/feedback/Toast';
import { Chip, IconButton, PrimaryButton } from '../components/glass/Controls';
import { Txt } from '../components/Txt';
import { useInventory } from '../hooks/useAppServices';
import { useTheme } from '../theme/ThemeProvider';

function AdjustStockSheet({ asset, restock, done }: { asset: MedicalAsset; restock: boolean; done: (delta: number) => void }) {
  const { tokens } = useTheme();
  const dialogs = useDialogs();
  const max = restock ? 999_999 : asset.quantity;
  // Suggest topping up to twice the reorder level; usage defaults to one.
  const [amount, setAmount] = useState(restock ? Math.max(1, asset.reorderLevel * 2 - asset.quantity) : 1);
  const set = (value: number) => setAmount(Math.min(Math.max(1, value), Math.max(1, max)));
  const color = restock ? tokens.safe : tokens.warning;
  const after = asset.quantity + (restock ? amount : -amount);
  const quick = (restock ? [10, 50, 100, 500] : [1, 2, 5, 10]).filter((n) => n <= max);

  const typeAmount = async () => {
    const value = await dialogs.prompt({
      title: restock ? 'Quantity received' : 'Quantity used',
      label: `Amount (${asset.unit})`,
      initialValue: String(amount),
      icon: 'dialpad',
      numeric: true,
    });
    const parsed = Number(value);
    if (value && parsed > 0) set(parsed);
  };

  return (
    <View>
      <Txt variant="title">{restock ? 'Restock' : 'Record usage'}</Txt>
      <Txt variant="bodySmall" style={{ marginTop: 2 }}>
        {asset.name}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22 }}>
        <IconButton icon="remove" label="Decrease" size={52} blur={false} disabled={amount <= 1} onPress={() => set(amount - 1)} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${amount} ${asset.unit}. Tap to type an amount`}
          onPress={typeAmount}
          style={{ flex: 1, alignItems: 'center' }}
        >
          <Txt variant="displayLarge" color={color}>
            {restock ? '+' : '−'}
            {amount}
          </Txt>
          <Txt variant="bodySmall">{asset.unit} · tap to type</Txt>
        </Pressable>
        <IconButton icon="add" label="Increase" size={52} blur={false} disabled={amount >= max} onPress={() => set(amount + 1)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
        {quick.map((n) => (
          <Chip key={n} label={`${restock ? '+' : ''}${n}`} color={color} selected={amount === n} onPress={() => set(n)} />
        ))}
        {!restock && asset.quantity > 0 ? (
          <Chip label={`All (${asset.quantity})`} color={color} selected={amount === asset.quantity} onPress={() => set(asset.quantity)} />
        ) : null}
      </View>
      <Txt variant="body" color={tokens.textSecondary} style={{ marginTop: 18 }}>
        Stock after:{' '}
        <Txt variant="label">
          {after} {asset.unit}
        </Txt>
        {after <= asset.reorderLevel ? <Txt variant="body" color={tokens.lowStock}>{'  ·  at or below reorder level'}</Txt> : null}
      </Txt>
      <PrimaryButton
        label={restock ? `Add ${amount} ${asset.unit}` : `Use ${amount} ${asset.unit}`}
        icon={restock ? 'add' : 'check'}
        onPress={() => done(restock ? amount : -amount)}
        style={{ marginTop: 22 }}
      />
    </View>
  );
}

/** Undoable stock and disposal actions shared by the alerts and detail screens. */
export function useStockActions() {
  const { vm } = useInventory();
  const dialogs = useDialogs();
  const toast = useToast();

  return {
    async adjust(asset: MedicalAsset, restock: boolean) {
      const delta = await dialogs.sheet<number>((close) => <AdjustStockSheet asset={asset} restock={restock} done={close} />, 0);
      if (!delta) return;
      await vm.adjustStock(asset, delta);
      toast.showUndo(
        delta > 0 ? `Added ${delta} ${asset.unit} to ${asset.name}` : `Recorded ${-delta} ${asset.unit} used`,
        () => void vm.undo(),
      );
    },

    async dispose(asset: MedicalAsset): Promise<boolean> {
      const confirmed = await dialogs.confirm({
        title: `Dispose ${asset.name}?`,
        message: `Records disposal of ${asset.quantity} ${asset.unit} from batch ${asset.batchNumber} and removes it from the shelf.`,
        confirmLabel: 'Dispose',
        icon: 'recycling',
        destructive: true,
      });
      if (!confirmed) return false;
      await vm.disposeAsset(asset);
      toast.showUndo(`${asset.name} disposed`, () => void vm.undo());
      return true;
    },
  };
}
