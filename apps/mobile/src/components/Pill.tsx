import { View, type ViewStyle } from 'react-native';
import { t } from '@/theme';
import { Text } from './Text';

type Tone = 'green' | 'brown' | 'teal' | 'gold' | 'gray' | 'solid';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: t.colors.green100, fg: t.colors.green900 },
  brown: { bg: t.colors.brown100, fg: t.colors.brown700 },
  teal: { bg: '#DDF3EF', fg: '#147E6E' },
  gold: { bg: '#FCEFD6', fg: '#9A6A12' },
  gray: { bg: t.colors.bg2, fg: t.colors.ink2 },
  solid: { bg: t.colors.green900, fg: '#FFFFFF' },
};

export interface PillProps {
  label: string;
  tone?: Tone;
  style?: ViewStyle;
}

/** Kiçik etiket — "Level 12", "Local Expert", "Aktiv" (ekran 07, 21, 23). */
export function Pill({ label, tone = 'green', style }: PillProps) {
  const c = TONES[tone];
  return (
    <View
      style={[
        {
          height: 24,
          paddingHorizontal: 10,
          borderRadius: t.radius.pill,
          backgroundColor: c.bg,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text style={{ color: c.fg, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
