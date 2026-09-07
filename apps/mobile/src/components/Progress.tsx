import { View, type ViewStyle } from 'react-native';
import { t } from '@/theme';

export interface ProgressProps {
  /** 0–100 */
  percent: number;
  tone?: 'green' | 'brown' | 'teal';
  thin?: boolean;
  style?: ViewStyle;
}

/** XP çubuğu — ekran 28, 29, 32; qazanc çubuğu — ekran 17, 56. */
export function Progress({ percent, tone = 'green', thin, style }: ProgressProps) {
  const color = tone === 'brown' ? t.colors.brown700 : tone === 'teal' ? t.colors.teal400 : t.colors.green900;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={[
        { height: thin ? 5 : 8, borderRadius: 4, backgroundColor: t.colors.bg2, overflow: 'hidden' },
        style,
      ]}
    >
      <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}
