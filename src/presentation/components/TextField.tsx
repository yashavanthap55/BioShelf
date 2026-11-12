import { useState, type ReactNode } from 'react';
import { TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';

import type { IconName } from '../theme/categoryStyle';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts } from '../theme/typography';
import { GlassView } from './glass/GlassView';
import { Icon } from './Icon';
import { Txt } from './Txt';

export interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  icon?: IconName;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  multiline?: boolean;
  /** Marks a value that was read from the label photo. */
  scanned?: boolean;
  trailing?: ReactNode;
  blur?: boolean;
  autoFocus?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  error,
  keyboardType,
  autoCapitalize = 'sentences',
  multiline = false,
  scanned = false,
  trailing,
  blur = false,
  autoFocus,
  returnKeyType,
  onSubmitEditing,
  testID,
}: TextFieldProps) {
  const { tokens } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <GlassView
        radius={18}
        blur={blur}
        borderColor={error ? tokens.expired : focused ? tokens.accent : undefined}
        style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', paddingLeft: 16, paddingRight: 10, minHeight: 58, gap: 12 }}
      >
        {icon ? (
          <View style={{ paddingTop: multiline ? 18 : 0 }}>
            <Icon name={icon} size={19} color={tokens.textSecondary} />
          </View>
        ) : null}
        <View style={{ flex: 1, paddingVertical: label ? 9 : 0 }}>
          {label ? (
            <Txt variant="labelMedium" color={focused ? tokens.accent : tokens.textMuted} style={{ fontSize: 11.5 }}>
              {label}
            </Txt>
          ) : null}
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={tokens.textMuted}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            multiline={multiline}
            autoFocus={autoFocus}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            selectionColor={tokens.accent}
            cursorColor={tokens.accent}
            accessibilityLabel={label ?? placeholder}
            testID={testID}
            style={{
              color: tokens.textPrimary,
              fontFamily: Fonts.medium,
              fontSize: 16,
              paddingVertical: label ? 2 : 16,
              paddingHorizontal: 0,
              minHeight: multiline ? 72 : undefined,
              textAlignVertical: multiline ? 'top' : 'center',
              outlineWidth: 0,
            }}
          />
        </View>
        {scanned ? (
          <View accessibilityLabel="Read from label" style={{ paddingHorizontal: 4 }}>
            <Icon name="auto-awesome" size={16} color={tokens.accent} />
          </View>
        ) : null}
        {trailing}
      </GlassView>
      {error ? (
        <Txt variant="bodySmall" color={tokens.expired} style={{ marginTop: 6, marginLeft: 16 }}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}
