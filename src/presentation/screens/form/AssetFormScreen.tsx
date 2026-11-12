import { router, usePreventRemove } from 'expo-router';
import { useEffect, useReducer, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addDays, toISODate, type ISODate } from '@/domain/dates';
import {
  ASSET_CATEGORIES,
  CATEGORY_INFO,
  dateLabelFor,
  isColdChain,
  STORAGE_CONDITIONS,
  STORAGE_INFO,
  tracksServiceDate,
} from '@/domain/entities';
import { LabelParser } from '@/domain/labelParser';
import type { CaptureSource, PickedImage } from '@/domain/media';
import { usePhotoUri } from '../../components/Badges';
import { GroupLabel } from '../../components/Common';
import { useDialogs } from '../../components/feedback/Dialogs';
import { useToast } from '../../components/feedback/Toast';
import { Chip, IconButton, PrimaryButton, tap } from '../../components/glass/Controls';
import { GlassView } from '../../components/glass/GlassView';
import { Icon } from '../../components/Icon';
import { TextField } from '../../components/TextField';
import { Txt } from '../../components/Txt';
import { useInventory, useServices } from '../../hooks/useAppServices';
import { CATEGORY_ICON, categoryColor, STORAGE_ICON, type IconName } from '../../theme/categoryStyle';
import { useTheme } from '../../theme/ThemeProvider';
import { formatDate } from '../../utils/formatters';
import { buildAsset, formReducer, initialFormState, validateForm, type AutoFillKey, type FieldKey } from './formState';
import { LabelPhotoSection } from './LabelPhotoSection';

const UNIT_SUGGESTIONS = ['tablets', 'capsules', 'vials', 'ampoules', 'bottles', 'units', 'boxes', 'pcs', 'kits', 'sets'];

const parser = new LabelParser();
const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

export function AssetFormScreen({ id }: { id?: string }) {
  const { vm } = useInventory();
  const { images, capture, labelReader } = useServices();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const dialogs = useDialogs();
  const toast = useToast();
  const [existing] = useState(() => (id ? vm.insightFor(id)?.asset : undefined));
  const [state, dispatch] = useReducer(formReducer, existing, initialFormState);
  const [saving, setSaving] = useState(false);
  const storedPhotoUri = usePhotoUri(state.photo ? null : state.photoRef);
  const photoUri = state.photo?.uri ?? storedPhotoUri;
  const service = tracksServiceDate(state.category);
  const policy = vm.policyFor(state.category);
  const scanned = (key: AutoFillKey) => state.autoFilled.includes(key);

  usePreventRemove(state.dirty && !state.saved, ({ repeat }) => {
    void dialogs
      .confirm({
        title: 'Discard changes?',
        message: 'What you entered on this form will be lost.',
        confirmLabel: 'Discard',
        icon: 'delete-sweep',
        destructive: true,
      })
      .then((discard) => discard && repeat());
  });

  useEffect(() => {
    if (state.saved) goBack();
  }, [state.saved]);

  const readLabel = async (image: PickedImage) => {
    if (!labelReader.isSupported) {
      dispatch({
        type: 'scan',
        status: 'unsupported',
        message: 'Photo attached. Automatic reading needs the installed BioShelf app (it isn’t available in Expo Go).',
      });
      return;
    }
    dispatch({ type: 'scan', status: 'reading' });
    try {
      const scan = await labelReader.read(image);
      dispatch({ type: 'applyScan', details: parser.parse(scan) });
    } catch (error) {
      dispatch({
        type: 'scan',
        status: 'failed',
        message: `Couldn’t read the label. ${error instanceof Error ? error.message : ''}`.trim(),
      });
    }
  };

  const pickPhoto = async (source: CaptureSource) => {
    let image: PickedImage | null = null;
    try {
      image = await capture.pick(source);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not open the camera');
      return;
    }
    if (!image) return;
    dispatch({ type: 'photo', photo: image });
    await readLabel(image);
  };

  const rescan = () => {
    if (state.photo) return void readLabel(state.photo);
    if (photoUri) void readLabel({ uri: photoUri });
  };

  const pickDate = async (which: 'manufactured' | 'expiry') => {
    const current = which === 'expiry' ? state.expiry : state.manufactured;
    const today = toISODate(new Date());
    const value = await dialogs.pickDate({
      title: which === 'expiry' ? dateLabelFor(state.category) : service ? 'Last serviced' : 'Manufactured',
      initial: current ?? (which === 'expiry' ? addDays(today, 365) : today),
    });
    if (value) dispatch({ type: 'date', which, value });
  };

  const save = async () => {
    const errors = validateForm(state);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'errors', errors });
      tap();
      return;
    }
    setSaving(true);
    let imageRef = state.photoRef;
    if (state.photo) {
      try {
        imageRef = await images.save(state.photo);
      } catch (error) {
        toast.show(`The photo could not be stored (${error instanceof Error ? error.message : 'error'}). Saved without it.`);
      }
    }
    const asset = buildAsset(state, existing, Date.now(), imageRef);
    if (existing) await vm.updateAsset(asset);
    else await vm.addAsset(asset);
    toast.showUndo(existing ? 'Changes saved' : 'Asset added to inventory', () => void vm.undo());
    setSaving(false);
    dispatch({ type: 'saved' });
  };

  const field = (key: FieldKey) => ({
    value: state.fields[key],
    onChangeText: (value: string) => dispatch({ type: 'field', key, value }),
    error: state.errors[key],
    scanned: scanned(key),
  });

  const scannedTag = (key: AutoFillKey) =>
    scanned(key) ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="auto-awesome" size={12} color={tokens.accent} />
        <Txt variant="eyebrow" color={tokens.accent}>
          From label
        </Txt>
      </View>
    ) : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <IconButton icon="close" label="Close" onPress={goBack} />
          <View style={{ flex: 1 }}>
            <Txt variant="eyebrow">{existing ? 'Edit asset' : 'New asset'}</Txt>
            <Txt variant="title" numberOfLines={1}>
              {existing ? existing.name : 'Add to inventory'}
            </Txt>
          </View>
        </View>

        <View style={{ marginTop: 24 }}>
          <LabelPhotoSection
            photoUri={photoUri}
            hasPhoto={!!state.photo || !!state.photoRef}
            status={state.scan.status}
            message={state.scan.message}
            canScan={labelReader.isSupported}
            onCamera={() => void pickPhoto('camera')}
            onUpload={() => void pickPhoto('gallery')}
            onRescan={rescan}
            onRemove={() => dispatch({ type: 'removePhoto' })}
            onUndoAutoFill={state.beforeAutoFill ? () => dispatch({ type: 'undoAutoFill' }) : undefined}
          />
        </View>

        <Section label="Category" right={scannedTag('category')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ASSET_CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={CATEGORY_INFO[category].label}
                icon={CATEGORY_ICON[category]}
                color={categoryColor(category, tokens.scheme)}
                selected={state.category === category}
                onPress={() => dispatch({ type: 'category', value: category })}
              />
            ))}
          </View>
          <GlassView blur={false} radius={18} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <Icon name="shield" size={20} color={tokens.accent} />
            <Txt variant="bodySmall" color={tokens.textPrimary} style={{ flex: 1 }}>
              <Txt variant="bodySmall" color={tokens.textPrimary} style={{ fontFamily: 'Manrope-Bold' }}>
                {policy.name} policy:{' '}
              </Txt>
              warns {policy.warningWindowDays} days ahead, critical from {policy.criticalWindowDays} days.
            </Txt>
          </GlassView>
        </Section>

        <Section label="Identity">
          <View style={{ gap: 12 }}>
            <TextField label="Item name *" icon="label" autoCapitalize="words" testID="field-name" {...field('name')} />
            <TextField label="Manufacturer / supplier *" icon="factory" autoCapitalize="words" {...field('maker')} />
            <TextField label={service ? 'Serial number *' : 'Batch / lot number *'} icon="qr-code-2" autoCapitalize="characters" {...field('batch')} />
          </View>
        </Section>

        <Section label="Stock">
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Quantity *"
                icon="numbers"
                keyboardType="number-pad"
                {...field('quantity')}
                onChangeText={(value) => dispatch({ type: 'field', key: 'quantity', value: value.replace(/\D/g, '') })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Unit *" icon="straighten" autoCapitalize="none" {...field('unit')} />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
            {UNIT_SUGGESTIONS.map((unit) => (
              <Chip key={unit} label={unit} selected={state.fields.unit.trim() === unit} onPress={() => dispatch({ type: 'field', key: 'unit', value: unit })} />
            ))}
          </ScrollView>
          <View style={{ marginTop: 12 }}>
            <TextField
              label="Reorder level *"
              placeholder="Flag as low stock at or below this"
              icon="low-priority"
              keyboardType="number-pad"
              {...field('reorder')}
              onChangeText={(value) => dispatch({ type: 'field', key: 'reorder', value: value.replace(/\D/g, '') })}
            />
          </View>
        </Section>

        <Section label="Storage" right={scannedTag('storage')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STORAGE_CONDITIONS.map((storage) => (
              <Chip
                key={storage}
                label={STORAGE_INFO[storage].label}
                icon={STORAGE_ICON[storage]}
                color={isColdChain(storage) ? tokens.accent : undefined}
                selected={state.storage === storage}
                onPress={() => dispatch({ type: 'storage', value: storage })}
              />
            ))}
          </View>
          <Txt variant="bodySmall" style={{ marginTop: 6, marginLeft: 4 }}>
            Required range: {STORAGE_INFO[state.storage].range}
          </Txt>
          <View style={{ marginTop: 12 }}>
            <TextField label="Location *" placeholder="e.g. Pharmacy · Rack A2" icon="place" autoCapitalize="words" {...field('location')} />
          </View>
        </Section>

        <Section label="Dates">
          <View style={{ gap: 12 }}>
            <DateField
              label={service ? 'Last serviced (optional)' : 'Manufactured (optional)'}
              value={state.manufactured}
              icon="precision-manufacturing"
              scanned={scanned('manufactured')}
              onPress={() => void pickDate('manufactured')}
              onClear={state.manufactured ? () => dispatch({ type: 'date', which: 'manufactured', value: null }) : undefined}
            />
            <DateField
              label={`${dateLabelFor(state.category)} *`}
              value={state.expiry}
              icon={service ? 'build-circle' : 'event-busy'}
              scanned={scanned('expiry')}
              error={state.errors.expiry}
              onPress={() => void pickDate('expiry')}
            />
          </View>
        </Section>

        <Section label="Notes">
          <TextField label="Handling notes" placeholder="Storage instructions, PO numbers, recall info…" icon="sticky-note-2" multiline {...field('notes')} />
        </Section>

        <PrimaryButton
          label={existing ? 'Save changes' : 'Add to inventory'}
          icon="check"
          loading={saving}
          onPress={() => void save()}
          style={{ marginTop: 30 }}
          testID="save-asset"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <GroupLabel right={right}>{label}</GroupLabel>
      {children}
    </View>
  );
}

function DateField({
  label,
  value,
  icon,
  onPress,
  onClear,
  error,
  scanned,
}: {
  label: string;
  value: ISODate | null;
  icon: IconName;
  onPress: () => void;
  onClear?: () => void;
  error?: string;
  scanned?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <View>
      <GlassView
        radius={18}
        blur={false}
        onPress={onPress}
        borderColor={error ? tokens.expired : undefined}
        accessibilityLabel={`${label}: ${value ? formatDate(value) : 'not set'}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 16, paddingRight: 12, minHeight: 58 }}
      >
        <Icon name={icon} size={19} color={tokens.textSecondary} />
        <View style={{ flex: 1, paddingVertical: 9 }}>
          <Txt variant="labelMedium" color={tokens.textMuted} style={{ fontSize: 11.5 }}>
            {label}
          </Txt>
          <Txt variant="bodyLarge" color={value ? tokens.textPrimary : tokens.textMuted}>
            {value ? formatDate(value) : 'Select date'}
          </Txt>
        </View>
        {scanned ? <Icon name="auto-awesome" size={16} color={tokens.accent} /> : null}
        {onClear ? (
          <Pressable accessibilityLabel="Clear date" hitSlop={8} onPress={onClear} style={{ padding: 6 }}>
            <Icon name="close" size={18} color={tokens.textSecondary} />
          </Pressable>
        ) : null}
        <Icon name="calendar-month" color={tokens.accent} />
      </GlassView>
      {error ? (
        <Txt variant="bodySmall" color={tokens.expired} style={{ marginTop: 6, marginLeft: 16 }}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}
