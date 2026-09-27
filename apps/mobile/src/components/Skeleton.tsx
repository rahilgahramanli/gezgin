import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/theme';
import { TopBar } from './TopBar';

/**
 * Yüklənmə vəziyyəti — spinner əvəzinə gələcək kontentin formasını göstərir.
 * Ekranın "sıçraması" azalır: skelet elementləri real kartla eyni ölçüdədir.
 */
export function Skeleton({
  width = '100%',
  height,
  radius = t.radius.sm,
  style,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: t.colors.bg2, opacity: pulse }, style]}
    />
  );
}

/** Lent kartının skeleti — ekran 05. */
export function PostSkeleton({ width }: { width: number }) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={styles.headText}>
          <Skeleton width={120} height={13} />
          <Skeleton width={170} height={11} />
        </View>
      </View>
      <Skeleton width={width} height={Math.round(width * 1.15)} radius={t.radius.lg} />
      <View style={styles.actions}>
        <Skeleton width={54} height={14} />
        <Skeleton width={54} height={14} />
        <Skeleton width={34} height={14} />
      </View>
      <Skeleton width="92%" height={13} />
      <Skeleton width="65%" height={13} />
    </View>
  );
}


/**
 * Detal ekranının skeleti — ekran 13, 15, 17.
 * Hero fotonun hündürlüyü real ekranla eynidir (300), ona görə kontent gələndə
 * səhifə tərpənmir. `onBack` verilsə yüklənmə zamanı da geri düyməsi olur —
 * yavaş şəbəkədə istifadəçi skeletdə ilişib qalmasın.
 */
export function DetailSkeleton({ onBack }: { onBack?: () => void } = {}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.detail}>
      <Skeleton width="100%" height={300} radius={0} />
      {onBack ? (
        <View style={[styles.detailBar, { top: insets.top }]}>
          <TopBar transparent onBack={onBack} />
        </View>
      ) : null}
      <View style={styles.detailBody}>
        <Skeleton width={90} height={16} radius={t.radius.pill} />
        <View style={styles.statRow}>
          <Skeleton width="31%" height={76} radius={t.radius.md} />
          <Skeleton width="31%" height={76} radius={t.radius.md} />
          <Skeleton width="31%" height={76} radius={t.radius.md} />
        </View>
        <Skeleton width="45%" height={18} />
        <Skeleton width="100%" height={13} />
        <Skeleton width="92%" height={13} />
        <Skeleton width="70%" height={13} />
      </View>
    </View>
  );
}

/** Siyahı ekranlarının skeleti — ekran 10, 14, 16, 08, 42. */
export function ListSkeleton({ rows = 5, thumb = 72 }: { rows?: number; thumb?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={thumb} height={thumb} radius={t.radius.md} />
          <View style={styles.rowText}>
            <Skeleton width="70%" height={15} />
            <Skeleton width="45%" height={12} />
            <Skeleton width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: t.spacing.md, marginBottom: t.spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  headText: { gap: 6 },
  actions: { flexDirection: 'row', gap: t.spacing.lg },
  detail: { flex: 1, backgroundColor: t.colors.bg },
  detailBar: { position: 'absolute', left: 0, right: 0 },
  detailBody: { padding: t.spacing.lg, gap: t.spacing.md },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: t.spacing.sm },
  list: { padding: t.spacing.lg, gap: t.spacing.lg },
  row: { flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' },
  rowText: { flex: 1, gap: 8 },
});
