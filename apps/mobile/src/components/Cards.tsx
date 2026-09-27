import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { t } from '@/theme';
import { Icon } from './Icon';
import { Photo, Rating } from './Media';
import { Text } from './Text';

/** Foto üzərində başlıq olan kart — ekran 10, 12 populyar məkanlar. */
export function PhotoCard({
  uri,
  title,
  subtitle,
  rating,
  height = 180,
  width,
  onPress,
  badge,
  accessibilityLabel,
}: {
  uri?: string | null;
  title: string;
  subtitle?: string | null;
  rating?: number | null;
  height?: number;
  width?: number;
  onPress?: () => void;
  badge?: string;
  /** Avtomatlaşdırılmış testlər kartı bu etiketlə tapır. */
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[styles.photoCard, { height, ...(width ? { width } : null) }]}
    >
      <Photo uri={uri} style={styles.fill} radius={t.radius.lg} />
      <View style={styles.shade} />
      {badge ? (
        <View style={styles.badge}>
          <Text variant="caption" style={styles.badgeText}>
            {badge}
          </Text>
        </View>
      ) : null}
      <View style={styles.photoCardBody}>
        <Text variant="h3" style={styles.onPhoto} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          {rating != null ? <Rating value={rating} color="#fff" /> : null}
          {subtitle ? (
            <View style={styles.metaRow}>
              <Icon name="pin" size={13} color="rgba(255,255,255,0.9)" />
              <Text variant="small" style={styles.onPhotoMeta} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Thumbnail + mətn + meta sətri — ekran 11, 12, 14, 33. */
export function RowCard({
  uri,
  title,
  subtitle,
  meta,
  right,
  onPress,
  style,
}: {
  uri?: string | null;
  title: string;
  subtitle?: string | null;
  meta?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.rowCard, style]}>
      <Photo uri={uri} style={styles.thumb} radius={12} />
      <View style={styles.rowBody}>
        <Text variant="h3" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="meta" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? <View style={styles.metaLine}>{meta}</View> : null}
      </View>
      {right ?? <Icon name="chevronRight" size={18} color={t.colors.muted} />}
    </Pressable>
  );
}

/** Təcrübə kartı — qiymət və reytinqlə (ekran 16). */
export function ExperienceCard({
  uri,
  title,
  subtitle,
  priceAzn,
  rating,
  ratingCount,
  width,
  onPress,
}: {
  uri?: string | null;
  title: string;
  subtitle?: string | null;
  priceAzn: number;
  rating?: number;
  ratingCount?: number;
  /** Piksel və ya faiz — grid-də `47.5%` kimi işlədilir. */
  width?: number | `${number}%`;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.expCard, width ? { width } : null]}>
      <Photo uri={uri} style={styles.expImage} radius={0} />
      <View style={styles.expBody}>
        <Text variant="h3" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="meta" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.expFooter}>
          <Text variant="small" style={styles.price}>
            {priceAzn} AZN
          </Text>
          {rating ? <Rating value={rating} count={ratingCount} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Statistika xanası — ekran 15, 28. */
export function StatCell({
  value,
  label,
  onPress,
}: {
  value: string | number;
  label: string;
  /** Verilsə xana toxunula bilən olur — ekran 28 → 32. */
  onPress?: () => void;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      style={styles.stat}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${label}: ${value}` : undefined}
    >
      <Text variant="h2" color="green900">
        {value}
      </Text>
      <Text variant="caption" style={{ marginTop: 2 }}>
        {label}
      </Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  photoCard: { borderRadius: t.radius.lg, overflow: 'hidden', backgroundColor: t.colors.bg2 },
  // RN 0.87-də `StyleSheet.absoluteFillObject` yoxdur — açıq yazılır
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  shade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,20,20,0.32)',
  },
  photoCardBody: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 4 },
  onPhoto: { color: '#fff' },
  onPhotoMeta: { color: 'rgba(255,255,255,0.92)' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: t.radius.pill,
  },
  badgeText: { color: '#fff', fontWeight: '600' },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: 10,
    backgroundColor: t.colors.paper,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.colors.line,
  },
  thumb: { width: 72, height: 72, backgroundColor: t.colors.bg2 },
  rowBody: { flex: 1, minWidth: 0 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginTop: 6 },
  expCard: {
    backgroundColor: t.colors.paper,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.line,
    overflow: 'hidden',
  },
  expImage: { height: 120, width: '100%', backgroundColor: t.colors.bg2 },
  expBody: { padding: t.spacing.md },
  expFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.sm },
  price: { fontWeight: '700', color: t.colors.green900 },
  stat: { flex: 1, alignItems: 'center' },
});
