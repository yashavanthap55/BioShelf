import { Text, type TextProps } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { TextVariant } from '../theme/typography';

export interface TxtProps extends TextProps {
  variant?: TextVariant;
  color?: string;
}

/** Text in one of the design system's type styles. */
export function Txt({ variant = 'body', color, style, ...rest }: TxtProps) {
  const { type } = useTheme();
  return <Text {...rest} style={[type[variant], color ? { color } : null, style]} />;
}
