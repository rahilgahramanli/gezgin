import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface TopBarProps {
  title?: string;
  onBack?: () => void;
  /** Sağ tərəfdəki ikonlar — ekran 13, 15, 23. */
  actions?: Array<{ icon: IconName; onPress?: () => void; badge?: boolean }>;
  right?: ReactNode;
  /** Foto üzərində ağ variant — ekran 13, 17, 41. */
  light?: boolean;
  transparent?: boolean;
}

export function TopBar({ title, onBack, actions, right, light, transparent }: TopBarProps) {
  const tint = light ? '#fff' : t.colors.ink;

  return (
    <View style={[styles.bar, transparent && styles.transparent]}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={[styles.iconBtn, light && styles.glass]}>
            <Icon name="chevronLeft" size={22} color={tint} />
          </Pressable>
        ) : null}
      </View>

      {title ? (
        <Text variant="h3" style={[styles.title, { color: tint }]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.title} />
      )}

      <View style={[styles.side, styles.right]}>
        {right}
        {actions?.map((a, i) => (
          <Pressable
            key={`${a.icon}-${i}`}
            onPress={a.onPress}
            hitSlop={10}
            style={[styles.iconBtn, light && styles.glass]}
          >
            <Icon name={a.icon} size={22} color={tint} />
            {a.badge ? <View style={styles.dot} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.spacing.lg,
    gap: t.spacing.sm,
  },
  transparent: { backgroundColor: 'transparent' },
  side: { minWidth: 40, flexDirection: 'row', alignItems: 'center', gap: 4 },
  right: { justifyContent: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  glass: { backgroundColor: 'rgba(255,255,255,0.25)' },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: t.colors.danger,
  },
});
