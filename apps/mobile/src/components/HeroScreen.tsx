import { useState, type ReactNode } from 'react';
import {
  ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/theme';
import { Screen } from './Screen';
import { TopBar, type TopBarProps } from './TopBar';

const BAR_HEIGHT = 56;

/**
 * Hero fotolu detal ekranı (ekran 13, 15, 17).
 *
 * Üst panel ScrollView-dən KƏNARDA, hero-nun üzərində sabit durur — əvvəllər
 * panel kontentlə birlikdə sürüşüb gedirdi və geri/saxla/paylaş düymələri
 * aşağıda əlçatmaz olurdu. Hero ekrandan çıxanda panel ağ fona və tünd
 * ikonlara keçir (ağ kontent üzərində şəffaf ağ düymələr görünmür).
 */
export function HeroScreen({
  hero,
  heroHeight,
  title,
  onBack,
  actions,
  footer,
  children,
}: {
  /** Hero-nun içi (foto, kölgə, başlıq) — hündürlüyü `heroHeight`-dir. */
  hero: ReactNode;
  heroHeight: number;
  /** Panel ağ fona keçəndə göstərilən başlıq. */
  title?: string;
  onBack?: () => void;
  actions?: TopBarProps['actions'];
  footer?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [solid, setSolid] = useState(false);
  const threshold = heroHeight - insets.top - BAR_HEIGHT;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > threshold;
    if (next !== solid) setSolid(next);
  };

  return (
    <Screen padded={false} edges={[]} scroll={false} footer={footer} contentStyle={styles.noPad}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={[styles.hero, { height: heroHeight }]}>{hero}</View>
        {children}
      </ScrollView>

      <View style={[styles.bar, { paddingTop: insets.top }, solid && styles.barSolid]} pointerEvents="box-none">
        <TopBar light={!solid} transparent title={solid ? title : undefined} onBack={onBack} actions={actions} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noPad: { paddingBottom: 0 },
  content: { paddingBottom: t.spacing.xxl },
  hero: { backgroundColor: t.colors.bg2, overflow: 'hidden' },
  bar: { position: 'absolute', top: 0, left: 0, right: 0 },
  barSolid: { backgroundColor: t.colors.bg, borderBottomWidth: 1, borderBottomColor: t.colors.line },
});
