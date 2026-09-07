import { Pressable, View, type ViewProps } from 'react-native';
import { t } from '@/theme';

export interface CardProps extends ViewProps {
  padded?: boolean;
  /** Verilsə kart toxunula bilən olur — ekran 28-dəki Score kartı kimi. */
  onPress?: () => void;
}

/** Ağ fon üzərində kartlar sərhəd + yumşaq kölgə ilə seçilir (design/gezgin.css `.card`). */
export function Card({ padded, style, onPress, children, ...rest }: CardProps) {
  const boxStyle = [
    {
      backgroundColor: t.colors.paper,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.line,
    },
    t.shadows.sm,
    padded && { padding: t.spacing.lg },
    style,
  ];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={boxStyle}>
        {children}
      </Pressable>
    );
  }

  return (
    <View style={boxStyle} {...rest}>
      {children}
    </View>
  );
}
