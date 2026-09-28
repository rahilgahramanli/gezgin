import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, LogoMark, Text } from '@/components';
import { useGuestLogin } from '@/api/hooks/auth';
import { useAuth } from '@/store/auth';
import { t } from '@/theme';
import type { AuthScreenProps } from '@/navigation/types';

/** Ekran 01 — açılış. */
export function SplashScreen({ navigation }: AuthScreenProps<'Splash'>) {
  const guest = useGuestLogin();
  const consumeAuthEntry = useAuth((st) => st.consumeAuthEntry);

  // Qonaq "Hesab yarat" ilə çıxıbsa birbaşa Qeydiyyata keçirik. Naviqator ilk
  // render-də hələ hazır deyil (NAVIGATE "işlənmədi"), ona görə növbəti kadrda keçirik;
  // dəyəri də yalnız keçid anında "istehlak" edirik — StrictMode-un ikiqat effekti itirməsin.
  useEffect(() => {
    if (!useAuth.getState().pendingAuthEntry) return;
    const id = requestAnimationFrame(() => {
      const entry = consumeAuthEntry();
      if (entry) navigation.navigate(entry);
    });
    return () => cancelAnimationFrame(id);
  }, [consumeAuthEntry, navigation]);

  return (
    <View style={styles.bg}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=70' }}
        style={[StyleSheet.absoluteFill, styles.bgImage]}
        resizeMode="cover"
      />
      <View style={styles.shade} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <LogoMark size={64} />
          <Text variant="titleXl" style={styles.brand}>
            GEZGIN
          </Text>
          <Text variant="body" style={styles.tagline}>
            Səyahət etmək yaşamaqdır
          </Text>
        </View>

        <View style={styles.bottom}>
          <Text variant="titleLg" style={styles.slogan}>
            Gəz, yaşa, paylaş!
          </Text>
          <Text variant="small" style={styles.sub}>
            Hər səyahət bir hekayədir. Sənin hekayən GEZGIN ilə başlayır.
          </Text>

          <Button
            label="Qeydiyyat"
            onPress={() => navigation.navigate('Register')}
            style={styles.cta}
          />
          <Button
            label="Daxil ol"
            variant="light"
            onPress={() => navigation.navigate('Login')}
            style={styles.cta}
          />
          <Button
            label="Qonaq kimi davam et"
            variant="ghost"
            loading={guest.isPending}
            onPress={() => guest.mutate()}
            textColor="#fff"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: t.colors.green900 },
  bgImage: { opacity: 0.9 },
  shade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,30,28,0.55)',
  },
  safe: { flex: 1, justifyContent: 'space-between', paddingHorizontal: t.spacing.page },
  top: { alignItems: 'center', marginTop: 64, gap: t.spacing.md },
  brand: { color: '#fff', letterSpacing: 1 },
  tagline: { color: 'rgba(255,255,255,0.85)' },
  bottom: { gap: t.spacing.md, paddingBottom: t.spacing.lg },
  slogan: { color: '#fff' },
  sub: { color: 'rgba(255,255,255,0.85)', marginBottom: t.spacing.md },
  cta: { width: '100%' },
});
