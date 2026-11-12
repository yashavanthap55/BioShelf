import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { daysBetween, isoFromParts, parseISODate, toISODate, type ISODate } from '@/domain/dates';
import type { IconName } from '../../theme/categoryStyle';
import { useTheme } from '../../theme/ThemeProvider';
import { withAlpha } from '../../theme/tokens';
import { IconButton, PrimaryButton, SecondaryButton } from '../glass/Controls';
import { GlassView } from '../glass/GlassView';
import { Icon } from '../Icon';
import { TextField } from '../TextField';
import { Txt } from '../Txt';
import { useOverlay } from './Overlay';

function DialogFrame({ children }: { children: ReactNode }) {
  return (
    <GlassView strong radius={28} style={{ padding: 24 }}>
      {children}
    </GlassView>
  );
}

function DialogIcon({ icon, color }: { icon: IconName; color: string }) {
  return (
    <View
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: withAlpha(color, 0.5),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
      }}
    >
      <Icon name={icon} size={24} color={color} />
    </View>
  );
}

/** Floating glass sheet with a grabber, for pickers and quick actions. */
export function SheetFrame({ children }: { children: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <GlassView strong radius={30} style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
      <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: withAlpha(tokens.textMuted, 0.5), marginBottom: 16 }} />
      {children}
    </GlassView>
  );
}

function PromptBody({
  title,
  label,
  initialValue,
  icon,
  numeric,
  close,
}: {
  title: string;
  label: string;
  initialValue: string;
  icon: IconName;
  numeric: boolean;
  close: (value: string | null) => void;
}) {
  const { tokens } = useTheme();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const submit = () => (value.trim() ? close(value.trim()) : setError('Required'));
  return (
    <DialogFrame>
      <DialogIcon icon={icon} color={tokens.accent} />
      <Txt variant="title" style={{ marginBottom: 18 }}>
        {title}
      </Txt>
      <TextField
        label={label}
        value={value}
        onChangeText={(v) => {
          setValue(numeric ? v.replace(/\D/g, '') : v);
          setError(null);
        }}
        keyboardType={numeric ? 'number-pad' : 'default'}
        autoCapitalize={numeric ? 'none' : 'words'}
        autoFocus
        error={error}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
        <SecondaryButton label="Cancel" onPress={() => close(null)} style={{ flex: 1 }} />
        <PrimaryButton label="Save" onPress={submit} style={{ flex: 1 }} />
      </View>
    </DialogFrame>
  );
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Glass calendar; tapping a day picks it. Works the same on every platform. */
function DatePickerBody({ title, initial, close }: { title: string; initial: ISODate; close: (value: ISODate | null) => void }) {
  const { tokens } = useTheme();
  const today = toISODate(new Date());
  const start = parseISODate(initial);
  const [view, setView] = useState({ year: start.year, month: start.month });

  const shift = (months: number) =>
    setView(({ year, month }) => {
      const index = year * 12 + (month - 1) + months;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });

  const firstWeekday = new Date(view.year, view.month - 1, 1).getDay();
  const daysInMonth = new Date(view.year, view.month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <SheetFrame>
      <Txt variant="eyebrow">{title}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 14, gap: 6 }}>
        <IconButton icon="keyboard-double-arrow-left" label="Previous year" size={36} blur={false} onPress={() => shift(-12)} />
        <IconButton icon="chevron-left" label="Previous month" size={36} blur={false} onPress={() => shift(-1)} />
        <Txt variant="title" style={{ flex: 1, textAlign: 'center' }}>
          {MONTH_NAMES[view.month - 1]} {view.year}
        </Txt>
        <IconButton icon="chevron-right" label="Next month" size={36} blur={false} onPress={() => shift(1)} />
        <IconButton icon="keyboard-double-arrow-right" label="Next year" size={36} blur={false} onPress={() => shift(12)} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((d, i) => (
          <Txt key={i} variant="eyebrow" style={{ flex: 1, textAlign: 'center', letterSpacing: 0 }}>
            {d}
          </Txt>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        {cells.map((day, i) => {
          if (day === null) return <View key={i} style={{ width: `${100 / 7}%`, height: 44 }} />;
          const iso = isoFromParts(view.year, view.month, day);
          const selected = iso === initial;
          const isToday = iso === today;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${day} ${MONTH_NAMES[view.month - 1]} ${view.year}`}
              onPress={() => close(iso)}
              style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? tokens.accent : 'transparent',
                  borderWidth: isToday && !selected ? 1 : 0,
                  borderColor: tokens.borderHighlight,
                }}
              >
                <Txt variant="label" color={selected ? tokens.onButton : daysBetween(today, iso) < 0 ? tokens.textMuted : tokens.textPrimary}>
                  {day}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
        <SecondaryButton label="Cancel" height={48} onPress={() => close(null)} style={{ flex: 1 }} />
        <SecondaryButton label="Today" height={48} onPress={() => close(today)} style={{ flex: 1 }} />
      </View>
    </SheetFrame>
  );
}

function PhotoViewerBody({ uri, close }: { uri: string; close: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        maximumZoomScale={5}
        centerContent
      >
        <Image source={{ uri }} style={{ width: '100%', aspectRatio: 3 / 4 }} contentFit="contain" />
      </ScrollView>
      <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
        <IconButton icon="close" label="Close photo" onPress={close} />
      </View>
    </View>
  );
}

/** Promise-based dialogs, sheets and pickers on top of the overlay host. */
export function useDialogs() {
  const overlay = useOverlay();
  const { tokens } = useTheme();

  return {
    confirm: (options: { title: string; message: string; confirmLabel: string; icon?: IconName; destructive?: boolean }) =>
      overlay.open<boolean>(
        'dialog',
        (close) => (
          <DialogFrame>
            <DialogIcon icon={options.icon ?? 'help-outline'} color={options.destructive ? tokens.expired : tokens.accent} />
            <Txt variant="title">{options.title}</Txt>
            <Txt variant="body" color={tokens.textSecondary} style={{ marginTop: 8 }}>
              {options.message}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <SecondaryButton label="Cancel" onPress={() => close(false)} style={{ flex: 1 }} />
              <PrimaryButton
                label={options.confirmLabel}
                destructive={options.destructive}
                onPress={() => close(true)}
                style={{ flex: 1 }}
              />
            </View>
          </DialogFrame>
        ),
        false,
      ),

    prompt: (options: { title: string; label: string; initialValue?: string; icon?: IconName; numeric?: boolean }) =>
      overlay.open<string | null>(
        'dialog',
        (close) => (
          <PromptBody
            title={options.title}
            label={options.label}
            initialValue={options.initialValue ?? ''}
            icon={options.icon ?? 'edit'}
            numeric={options.numeric ?? false}
            close={close}
          />
        ),
        null,
      ),

    pickDate: (options: { title: string; initial: ISODate }) =>
      overlay.open<ISODate | null>('sheet', (close) => <DatePickerBody title={options.title} initial={options.initial} close={close} />, null),

    sheet: <T,>(render: (close: (value: T) => void) => ReactNode, dismissValue: T) =>
      overlay.open<T>('sheet', (close) => <SheetFrame>{render(close)}</SheetFrame>, dismissValue),

    viewPhoto: (uri: string) =>
      overlay.open<void>('fullscreen', (close) => <PhotoViewerBody uri={uri} close={() => close(undefined)} />, undefined),
  };
}
