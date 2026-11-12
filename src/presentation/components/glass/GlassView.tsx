import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

export interface GlassViewProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Frost the backdrop. Off for rows repeated in lists. */
  blur?: boolean;
  strong?: boolean;
  /** Overrides the light-catching top hairline (e.g. for errors). */
  borderColor?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'none';
  testID?: string;
}

// Android needs a BlurTargetView around the blurred content and cannot blur
// views inside it, so surfaces there use translucent glass; the backdrop is
// already a soft gradient, so the frosted look is preserved.
const CAN_BLUR = Platform.OS === 'ios' || Platform.OS === 'web';

/**
 * The core glass surface: backdrop blur (where the platform supports it), a
 * whisper of translucent fill and a hairline that catches light along the
 * top edge. No coloured glows.
 */
export function GlassView({
  children,
  style,
  radius = 24,
  blur = true,
  strong = false,
  borderColor,
  onPress,
  onLongPress,
  disabled,
  accessibilityLabel,
  accessibilityRole,
  testID,
}: GlassViewProps) {
  const { tokens } = useTheme();
  const fill = strong ? tokens.glassFillStrong : tokens.glassFill;

  const layers = (
    <>
      {blur && CAN_BLUR ? (
        <BlurView intensity={tokens.blurIntensity} tint={tokens.blurTint} style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient
        colors={[fill, strong ? fill : tokens.scheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.35)']}
        style={StyleSheet.absoluteFill}
      />
    </>
  );

  const frame: ViewStyle = {
    borderRadius: radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.borderFaint,
    borderTopColor: borderColor ?? tokens.borderHighlight,
  };

  if (!onPress && !onLongPress) {
    return (
      <View style={[frame, style]} testID={testID} accessibilityLabel={accessibilityLabel}>
        {layers}
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [frame, style, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
    >
      {layers}
      {children}
    </Pressable>
  );
}

/** A plain transparent spacer row that keeps children on top of glass layers. */
export const glassRow: ViewStyle = { flexDirection: 'row', alignItems: 'center' };
