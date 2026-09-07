import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { t } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

/** Şəkil yüklənməyəndə boş qutu yerinə fon rəngi göstərilir. */
export function Photo({
  uri,
  style,
  radius = t.radius.md,
}: {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  radius?: number;
}) {
  if (!uri) {
    return <View style={[styles.placeholder, { borderRadius: radius }, style as StyleProp<ViewStyle>]} />;
  }
  return <Image source={{ uri }} style={[{ borderRadius: radius }, style]} resizeMode="cover" />;
}

export interface AvatarProps {
  uri?: string | null;
  size?: number;
  /** Hekayə halqası — ekran 05. */
  ring?: boolean;
  ringColor?: string;
}

export function Avatar({ uri, size = 44, ring, ringColor = t.colors.green900 }: AvatarProps) {
  const inner = (
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
