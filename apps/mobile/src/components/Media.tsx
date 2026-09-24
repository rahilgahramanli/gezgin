import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { t } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

/** Şəkil yüklənməyəndə boş qutu yerinə fon rəngi göstərilir. */
export function Photo({
  uri,
  style,
  radius = t.radius.md,
  resizeMode = 'cover',
}: {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  radius?: number;
  /** Tam ekran baxışda foto kəsilməməlidir — ekran 40, 46. */
  resizeMode?: 'cover' | 'contain';
}) {
  if (!uri) {
    return <View style={[styles.placeholder, { borderRadius: radius }, style as StyleProp<ViewStyle>]} />;
  }
  return <Image source={{ uri }} style={[{ borderRadius: radius }, style]} resizeMode={resizeMode} />;
}

export interface AvatarProps {
  uri?: string | null;
  size?: number;
  /** Hekayə halqası — ekran 05. */
  ring?: boolean;
  ringColor?: string;
  /** Şəkil yoxdursa baş hərflər göstərilir — boş boz dairə əvəzinə. */
  name?: string | null;
}

/** Ada görə sabit rəng — eyni adam həmişə eyni rəngdə görünür. */
const MONOGRAM_COLORS = [t.colors.green900, t.colors.brown700, '#147E6E', '#9A6A12', '#4A5D5A'] as const;

function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toLocaleUpperCase('az');
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return MONOGRAM_COLORS[hash % MONOGRAM_COLORS.length] ?? t.colors.green900;
}

export function Avatar({ uri, size = 44, ring, ringColor = t.colors.green900, name }: AvatarProps) {
  const initials = uri ? '' : initialsOf(name);

  const inner = initials ? (
    // Monoqram hərfləri yalnız dekorativdir — ekran oxuyucusu və birləşmiş
    // accessibility etiketləri onu "KK, Kamran Köməkçi" kimi oxumamalıdır.
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colorFor(name ?? ''),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontFamily: t.fonts.display,
          fontWeight: '700',
          fontSize: Math.round(size * 0.36),
          lineHeight: Math.round(size * 0.42),
        }}
      >
        {initials}
      </Text>
    </View>
  ) : (
    <Photo
      uri={uri}
      radius={size / 2}
      style={{ width: size, height: size, backgroundColor: t.colors.bg2 }}
    />
  );
  if (!ring) return inner;
  return (
    <View style={[styles.ring, { borderColor: ringColor, borderRadius: (size + 8) / 2, padding: 2 }]}>
      {inner}
    </View>
  );
}

/** Ulduz reytinqi — ekran 12, 13, 16. */
export function Rating({
  value,
  count,
  size = 14,
  color = t.colors.ink,
}: {
  value: number;
  count?: number | null;
  size?: number;
  color?: string;
}) {
  return (
    <View style={styles.row}>
      <Icon name="star" size={size} color={t.colors.star} filled />
      <Text variant="small" style={{ fontWeight: '600', color }}>
        {value.toFixed(1)}
      </Text>
      {count ? (
        <Text variant="small" color="muted">
          ({count.toLocaleString('az-AZ')})
        </Text>
      ) : null}
    </View>
  );
}

/** Bölmə başlığı + "Daha çox ›" — ekran 10, 12, 14, 16. */
export function SectionHead({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="h2">{title}</Text>
      {actionLabel ? (
        <Text variant="small" color="green900" onPress={onAction} style={styles.link}>
          {actionLabel} ›
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: t.colors.bg2 },
  ring: { borderWidth: 2, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: t.spacing.md,
  },
  link: { fontWeight: '500' },
});
