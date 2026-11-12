import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme, type TextStyle } from 'react-native';

import type { ThemePreference } from '@/domain/entities';
import { DARK, LIGHT, type GlassTokens } from './tokens';
import { buildTypography, type TextVariant } from './typography';

interface Theme {
  readonly tokens: GlassTokens;
  readonly type: Record<TextVariant, TextStyle>;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ preference, children }: { preference: ThemePreference; children: ReactNode }) {
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo(() => {
    const tokens = scheme === 'light' ? LIGHT : DARK;
    return { tokens, type: buildTypography(tokens) };
  }, [scheme]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
