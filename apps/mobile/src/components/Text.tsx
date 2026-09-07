import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { t } from '@/theme';

type Variant = keyof typeof t.typography;

export interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: keyof typeof t.colors;
  center?: boolean;
}

/** Bütün mətn bu komponentdən keçir — tipoqrafiya şkalası bir yerdə saxlanılır. */
export function Text({ variant = 'body', color = 'ink', center, style, ...rest }: TextProps) {
  const base = t.typography[variant] as TextStyle;
  return (
    <RNText
      style={[base, { color: t.colors[color] }, center && { textAlign: 'center' }, style]}
      {...rest}
    />
  );
}
