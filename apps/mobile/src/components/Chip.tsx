import { Pressable, type ViewStyle } from 'react-native';
import { t } from '@/theme';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  active?: boolean;
  tone?: 'green' | 'brown';
  onPress?: () => void;
  style?: ViewStyle;
}

/** Filtr çipləri — ekran 10, 12, 14, 16, 20, 45. */
export function Chip({ label, active, tone = 'green', onPress, style }: ChipProps) {
  const activeBg = tone === 'brown' ? t.colors.brown700 : t.colors.green900;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        {
          height: 38,
          paddingHorizontal: 16,
          borderRadius: t.radius.pill,
          borderWidth: 1,
          borderColor: active ? activeBg : t.colors.line,
          backgroundColor: active ? activeBg : t.colors.paper,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Text
        variant="small"
        style={{ color: active ? '#FFFFFF' : t.colors.ink2, fontWeight: '500', fontSize: 14 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
