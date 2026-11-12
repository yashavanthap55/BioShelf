import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildDemoInventory } from '@/data/demoInventory';
import { ASSET_CATEGORIES, CATEGORY_INFO, type AlertSensitivity, type ThemePreference } from '@/domain/entities';
import { ALERT_SENSITIVITIES, SENSITIVITY_INFO } from '@/domain/policies';
import { GroupLabel, ScreenHeader } from '../components/Common';
import { useDialogs } from '../components/feedback/Dialogs';
import { useToast } from '../components/feedback/Toast';
import { SegmentedControl, type Segment } from '../components/glass/Controls';
import { GlassView } from '../components/glass/GlassView';
import { TAB_BAR_HEIGHT } from '../components/GlassTabBar';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { useInventory, useSettings } from '../hooks/useAppServices';
import { CATEGORY_ICON, categoryColor, type IconName } from '../theme/categoryStyle';
import { useTheme } from '../theme/ThemeProvider';

const PATTERNS: [string, string][] = [
  ['MVVM', 'View-models own state; components only render and send intents'],
  ['Repository', 'Asset, activity, settings and photo stores behind interfaces (SQLite / browser / in-memory)'],
  ['Data Mapper', 'AssetMapper converts storage rows to domain entities'],
  ['Strategy', 'Per-category expiry policies and interchangeable sort orders'],
  ['Decorator', 'ScaledExpiryPolicy layers sensitivity over any policy; CachedImageStore'],
  ['Factory', 'ExpiryPolicyFactory and the demo inventory factory'],
  ['Specification', 'Search and filters composed with and / or / not'],
  ['Command', 'Every change is undoable and written to the audit trail'],
  ['Chain of Responsibility', 'Label parser passes OCR text through a chain of field extractors'],
  ['Adapter', 'ML Kit / Apple Vision and Tesseract.js behind one LabelTextReader'],
  ['Observer', 'Repository change listeners and view-model subscriptions'],
  ['Singleton', 'ServiceLocator composition root'],
];

const THEME_SEGMENTS: Segment<ThemePreference>[] = [
  { value: 'system', label: 'System', icon: 'brightness-auto' },
  { value: 'light', label: 'Light', icon: 'light-mode' },
  { value: 'dark', label: 'Dark', icon: 'dark-mode' },
];

const SENSITIVITY_SEGMENTS: Segment<AlertSensitivity>[] = ALERT_SENSITIVITIES.map((value) => ({
  value,
  label: SENSITIVITY_INFO[value].label,
}));

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  color,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress?: () => void;
  color?: string;
}) {
  const { tokens } = useTheme();
  const c = color ?? tokens.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, opacity: !onPress ? 0.5 : pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: tokens.borderHighlight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="titleSmall" color={color}>
          {title}
        </Txt>
        <Txt variant="bodySmall" numberOfLines={1}>
          {subtitle}
        </Txt>
      </View>
      <Icon name="chevron-right" color={tokens.textMuted} />
    </Pressable>
  );
}

export function SettingsScreen() {
  const { vm: settingsVm, state: settings } = useSettings();
  const { vm, state } = useInventory();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const dialogs = useDialogs();
  const toast = useToast();

  const initials = settings.facilityName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const editFacility = async () => {
    const name = await dialogs.prompt({
      title: 'Facility name',
      label: 'Hospital, clinic or pharmacy',
      initialValue: settings.facilityName,
      icon: 'local-hospital',
    });
    if (name) await settingsVm.setFacilityName(name);
  };

  const exportCsv = async () => {
    await Clipboard.setStringAsync(vm.exportCsv());
    toast.show(`CSV of ${state.stats.total} assets copied to clipboard`);
  };

  const loadSample = async () => {
    const ok = await dialogs.confirm({
      title: 'Load sample inventory?',
      message: 'This replaces all current assets and the audit trail with demo data.',
      confirmLabel: 'Load sample',
      icon: 'auto-awesome',
    });
    if (!ok) return;
    await vm.replaceAll(buildDemoInventory(new Date()), 'Sample inventory loaded');
    toast.show('Sample inventory loaded');
  };

  const clearAll = async () => {
    const ok = await dialogs.confirm({
      title: 'Clear all data?',
      message: 'Every asset and audit entry will be permanently deleted. This cannot be undone.',
      confirmLabel: 'Clear all',
      icon: 'delete-forever',
      destructive: true,
    });
    if (!ok) return;
    await vm.clearAll();
    toast.show('All data cleared');
  };

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 48 }}>
      <ScreenHeader eyebrow="Preferences" title="Settings" />

      <GlassView radius={26} onPress={editFacility} accessibilityLabel={`Facility: ${settings.facilityName}. Tap to rename`} style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: tokens.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="title" color={tokens.accent}>
            {initials}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="titleMedium" numberOfLines={1}>
            {settings.facilityName}
          </Txt>
          <Txt variant="bodySmall" style={{ marginTop: 2 }}>
            {state.stats.total} assets · {state.stats.coldChain} cold-chain
          </Txt>
        </View>
        <Icon name="edit" size={20} color={tokens.textSecondary} />
      </GlassView>

      <View style={{ marginTop: 26 }}>
        <GroupLabel>Appearance</GroupLabel>
        <SegmentedControl segments={THEME_SEGMENTS} selected={settings.themePreference} onChange={(value) => void settingsVm.setThemePreference(value)} />
      </View>

      <View style={{ marginTop: 26 }}>
        <GroupLabel>Alert sensitivity</GroupLabel>
        <SegmentedControl segments={SENSITIVITY_SEGMENTS} selected={settings.sensitivity} onChange={(value) => void settingsVm.setSensitivity(value)} />
        <GlassView blur={false} style={{ marginTop: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
          <Txt variant="bodySmall">{SENSITIVITY_INFO[settings.sensitivity].description}</Txt>
          <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 4 }}>
            <Txt variant="eyebrow" style={{ flex: 1 }}>
              Category
            </Txt>
            <Txt variant="eyebrow" color={tokens.warning} style={{ width: 60, textAlign: 'right' }}>
              Warn
            </Txt>
            <Txt variant="eyebrow" color={tokens.critical} style={{ width: 84, textAlign: 'right' }}>
              Critical
            </Txt>
          </View>
          {ASSET_CATEGORIES.map((category) => {
            const policy = vm.policyFor(category);
            return (
              <View key={category} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 }}>
                <Icon name={CATEGORY_ICON[category]} size={17} color={categoryColor(category, tokens.scheme)} />
                <Txt variant="body" style={{ flex: 1 }}>
                  {CATEGORY_INFO[category].label}
                </Txt>
                <Txt variant="label" color={tokens.warning} style={{ width: 50, textAlign: 'right' }}>
                  {policy.warningWindowDays}d
                </Txt>
                <Txt variant="label" color={tokens.critical} style={{ width: 84, textAlign: 'right' }}>
                  {policy.criticalWindowDays}d
                </Txt>
              </View>
            );
          })}
        </GlassView>
      </View>

      <View style={{ marginTop: 26 }}>
        <GroupLabel>Data</GroupLabel>
        <GlassView style={{ paddingVertical: 6 }}>
          <SettingsRow icon="table-view" title="Export as CSV" subtitle={`Copy ${state.stats.total} rows to the clipboard`} onPress={exportCsv} />
          <SettingsRow icon="undo" title="Undo last change" subtitle={state.undoLabel ?? 'Nothing to undo'} onPress={state.canUndo ? () => void vm.undo() : undefined} />
          <SettingsRow icon="redo" title="Redo" subtitle={state.redoLabel ?? 'Nothing to redo'} onPress={state.canRedo ? () => void vm.redo() : undefined} />
          <SettingsRow icon="auto-awesome" title="Load sample inventory" subtitle="Replace current data with demo stock" onPress={loadSample} />
          <SettingsRow icon="delete-forever" title="Clear all data" subtitle="Remove every asset and audit entry" color={tokens.expired} onPress={clearAll} />
        </GlassView>
      </View>

      <View style={{ marginTop: 26 }}>
        <GroupLabel>About</GroupLabel>
        <GlassView style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <LinearGradient colors={[...tokens.buttonColors]} style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="health-and-safety" size={24} color={tokens.onButton} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Txt variant="title">BioShelf</Txt>
              <Txt variant="bodySmall">Healthcare Asset & Expiry Tracker · v1.0.0</Txt>
            </View>
          </View>
          <Txt variant="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>
            Design patterns
          </Txt>
          {PATTERNS.map(([name, detail]) => (
            <View key={name} style={{ flexDirection: 'row', gap: 10, paddingVertical: 5 }}>
              <View style={{ marginTop: 7, width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.accent }} />
              <Txt variant="bodySmall" style={{ flex: 1 }}>
                <Txt variant="bodySmall" color={tokens.textPrimary} style={{ fontFamily: 'Manrope-Bold' }}>
                  {name}
                </Txt>
                {'  '}
                {detail}
              </Txt>
            </View>
          ))}
        </GlassView>
      </View>
    </ScrollView>
  );
}
