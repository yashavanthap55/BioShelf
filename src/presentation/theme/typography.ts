import type { TextStyle } from 'react-native';

import type { GlassTokens } from './tokens';

/** Font family names registered with expo-font in the root layout. */
export const Fonts = {
  serif: 'InstrumentSerif',
  serifItalic: 'InstrumentSerif-Italic',
  regular: 'Manrope-Regular',
  medium: 'Manrope-Medium',
  semibold: 'Manrope-SemiBold',
  bold: 'Manrope-Bold',
  extrabold: 'Manrope-ExtraBold',
} as const;

export const FONT_FILES = {
  [Fonts.serif]: require('../../../assets/fonts/InstrumentSerif-Regular.ttf'),
  [Fonts.serifItalic]: require('../../../assets/fonts/InstrumentSerif-Italic.ttf'),
  [Fonts.regular]: require('../../../assets/fonts/Manrope-Regular.ttf'),
  [Fonts.medium]: require('../../../assets/fonts/Manrope-Medium.ttf'),
  [Fonts.semibold]: require('../../../assets/fonts/Manrope-SemiBold.ttf'),
  [Fonts.bold]: require('../../../assets/fonts/Manrope-Bold.ttf'),
  [Fonts.extrabold]: require('../../../assets/fonts/Manrope-ExtraBold.ttf'),
};

export type TextVariant =
  | 'displayLarge'
  | 'display'
  | 'headlineLarge'
  | 'headline'
  | 'headlineSmall'
  | 'title'
  | 'titleMedium'
  | 'titleSmall'
  | 'bodyLarge'
  | 'body'
  | 'bodySmall'
  | 'label'
  | 'labelMedium'
  | 'eyebrow';

/**
 * Editorial serif (single weight) for titles and key figures; Manrope for
 * UI text; wide-tracked small caps (`eyebrow`) for labels.
 */
export function buildTypography(t: GlassTokens): Record<TextVariant, TextStyle> {
  const serif = (fontSize: number, letterSpacing: number): TextStyle => ({
    fontFamily: Fonts.serif,
    fontSize,
    lineHeight: Math.round(fontSize * 1.12),
    letterSpacing,
    color: t.textPrimary,
  });
  const sans = (
    fontFamily: string,
    fontSize: number,
    color: string,
    letterSpacing = 0,
    lineHeight = 1.45,
  ): TextStyle => ({ fontFamily, fontSize, color, letterSpacing, lineHeight: Math.round(fontSize * lineHeight) });

  return {
    displayLarge: serif(48, -1),
    display: serif(42, -0.8),
    headlineLarge: serif(36, -0.6),
    headline: serif(32, -0.5),
    headlineSmall: serif(27, -0.3),
    title: serif(23, -0.2),
    titleMedium: sans(Fonts.semibold, 16, t.textPrimary, 0, 1.3),
    titleSmall: sans(Fonts.semibold, 14, t.textPrimary, 0, 1.3),
    bodyLarge: sans(Fonts.medium, 16, t.textPrimary),
    body: sans(Fonts.medium, 14, t.textPrimary),
    bodySmall: sans(Fonts.medium, 12.5, t.textSecondary),
    label: sans(Fonts.semibold, 14, t.textPrimary, 0.2),
    labelMedium: sans(Fonts.semibold, 12, t.textSecondary, 0.2),
    eyebrow: { ...sans(Fonts.bold, 10.5, t.textMuted, 1.8), textTransform: 'uppercase' },
  };
}
