import type { ReactNode } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

const BREAKPOINT = 720;
const WIDTH = 412;
const MAX_HEIGHT = 915;

/**
 * On wide browser windows the phone UI is shown in a centred, phone-sized
 * glass slab instead of stretching edge to edge. A no-op on phones.
 */
export function DeviceFrame({ children }: { children: ReactNode }) {
  const { tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < BREAKPOINT) return <View style={{ flex: 1 }}>{children}</View>;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: WIDTH,
          height: Math.min(height - 48, MAX_HEIGHT),
          borderRadius: 40,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: tokens.borderFaint,
          borderTopColor: tokens.borderHighlight,
          backgroundColor: tokens.glassFill,
        }}
      >
        {children}
      </View>
    </View>
  );
}
