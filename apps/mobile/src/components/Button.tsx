import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { t } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'brown' | 'outline' | 'soft' | 'ghost' | 'light' | 'danger';
type Size = 'lg' | 'sm' | 'xs';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
  /** Foto üzərindəki düymələr üçün mətn rəngini üstələyir (ekran 01). */
  textColor?: string;
}

const HEIGHT: Record<Size, number> = { lg: 52, sm: 40, xs: 32 };
const FONT: Record<Size, number> = { lg: 16, sm: 14, xs: 13 };

const BG: Record<Variant, string> = {
  primary: t.colors.green900,
  brown: t.colors.brown700,
  outline: 'transparent',
  soft: t.colors.green100,
  ghost: 'transparent',
  light: t.colors.paper,
  danger: '#FBE9E7',
};

const FG: Record<Variant, string> = {
  primary: '#FFFFFF',
  brown: '#FFFFFF',
  outline: t.colors.green900,
  soft: t.colors.green900,
  ghost: t.colors.green900,
  light: t.colors.green900,
  danger: t.colors.danger,
};

export function Button({
  label, onPress, variant = 'primary', size = 'lg',
  block, disabled, loading, left, right, style, textColor,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const fg = textColor ?? FG[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      // `accessible` olmadan iOS düyməni ayrıca element kimi elan etmir:
      // VoiceOver "düymə" demir, mətn uşaq element kimi oxunur
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          backgroundColor: BG[variant],
          borderRadius: size === 'xs' ? t.radius.sm : t.radius.pill,
          paddingHorizontal: size === 'lg' ? 22 : size === 'sm' ? 16 : 12,
        },
        variant === 'outline' && { borderWidth: 1.5, borderColor: t.colors.green900 },
        (variant === 'primary' || variant === 'brown') && t.shadows.sm,
        block && { alignSelf: 'stretch' },
        pressed && { opacity: 0.85 },
        isDisabled && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.row}>
          {left}
          <Text style={{ color: fg, fontSize: FONT[size], fontWeight: "600" }}>{label}</Text>
          {right}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
