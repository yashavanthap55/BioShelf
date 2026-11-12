import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { IconName } from '../theme/categoryStyle';
import { useTheme } from '../theme/ThemeProvider';

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { tokens } = useTheme();
  return <MaterialIcons name={name} size={size} color={color ?? tokens.textPrimary} />;
}
