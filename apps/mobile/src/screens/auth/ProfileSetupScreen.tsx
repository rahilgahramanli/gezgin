import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import { Avatar, Button, Card, Icon, Input, Pill, Screen, Text, TopBar } from '@/components';
import { useMe, useSetProfileMedia, useUpdateMe } from '@/api/hooks/me';
import { PICKER_OPTIONS, uploadImage } from '@/api/upload';
import { useAuth } from '@/store/auth';
import { ensurePermission } from '@/lib/location';
import { alertError } from '@/lib/errors';
import { t } from '@/theme';

const BIO_MAX = 300;

/**
 * Ekran 39 — onboardingin son addımı: foto, istifadəçi adı, bio və icazələr.
 * Addım keçilə bilər; maraqlar artıq yadda saxlanıldığı üçün hesab hazırdır.
 */
export function ProfileSetupScreen() {
  const me = useMe();
  const update = useUpdateMe();
  const setAvatar = useSetProfileMedia('avatar');
  const patchUser = useAuth((s) => s.patchUser);

  const [username, setUsername] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [uploading, setUploading] = useState(false);
  const [locationAsked, setLocationAsked] = useState(false);

  const finish = () => patchUser({ onboardingCompleted: true });

  const pickAvatar = async () => {
    const res = await launchImageLibrary({ ...PICKER_OPTIONS, selectionLimit: 1 });
    const asset: Asset | undefined = res.assets?.[0];
    if (!asset) return;

    setUploading(true);
    try {
      const media = await uploadImage(asset, 'avatar');
      await setAvatar.mutateAsync(media.publicId);
    } catch (error) {
      alertError(error, 'Şəkil yüklənmədi');
    } finally {
      setUploading(false);
    }
  };

  const askLocation = async () => {
    setLocationAsked(true);
    // İcazə dialoqu yalnız bir dəfə çıxır — rədd edilsə tənzimləmələrdən açılır
    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert(
        'Yerləşmə icazəsi verilmədi',
        'Check-in və “Yaxınlıqda” lenti üçün sonradan Tənzimləmələrdən icazə verə bilərsən.',
      );
    }
  };

  const save = async () => {
    const name = (username ?? me.data?.username ?? '').trim();
    try {
      await update.mutateAsync({
        ...(name && name !== me.data?.username ? { username: name } : {}),
        ...(bio.trim() ? { bio: bio.trim() } : {}),
      });
      finish();
    } catch (error) {
      alertError(error, 'Profil yadda saxlanılmadı');
    }
  };

  return (
    <Screen
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button block label="Başlayaq" loading={update.isPending} onPress={() => void save()} />
          <Button block label="Sonra edərəm" variant="ghost" onPress={finish} />
        </View>
      }
    >
      <TopBar />

      <View style={styles.body}>
        <Pill label="Addım 3 / 3" tone="green" />
        <Text variant="titleXl">Özünü tanıt</Text>
        <Text variant="meta">Digər gezginlər səni belə görəcək</Text>

        <View style={styles.avatarRow}>
          <Avatar uri={me.data?.avatarUrl} size={88} name={me.data?.fullName} />
          <Button
            label={uploading ? 'Yüklənir…' : 'Şəkil seç'}
            variant="soft"
            size="sm"
            left={<Icon name="camera" size={16} color={t.colors.green900} />}
            onPress={() => void pickAvatar()}
          />
        </View>

        <Input
          label="İstifadəçi adı"
          icon="at"
          autoCapitalize="none"
          value={username ?? me.data?.username ?? ''}
          onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
        />
        <Input
          label={`Haqqında (${bio.length}/${BIO_MAX})`}
          multiline
          numberOfLines={3}
          placeholder="Nələri sevirsən? Hansı regionları gəzmisən?"
          value={bio}
          onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
        />

        <Card padded style={styles.permission}>
          <Icon name="pin" size={20} color={t.colors.green900} />
          <View style={styles.permissionText}>
            <Text variant="body">Yerləşmə icazəsi</Text>
            <Text variant="meta" color="muted">
              Check-in etmək və yaxınlıqdakı məkanları görmək üçün
            </Text>
          </View>
          <Button
            label={locationAsked ? 'Soruşuldu' : 'İcazə ver'}
            variant={locationAsked ? 'soft' : 'primary'}
            size="sm"
            disabled={locationAsked}
            onPress={() => void askLocation()}
          />
        </Card>

        <View style={styles.reward}>
          <Icon name="sparkle" size={18} color={t.colors.brown700} />
          <Text variant="small" color="brown700">
            Profil tamamlandı — +100 XP qazandın
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: t.spacing.page, gap: t.spacing.md },
  avatarRow: { alignItems: 'center', gap: t.spacing.md, marginVertical: t.spacing.md },
  permission: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginTop: t.spacing.sm },
  permissionText: { flex: 1, gap: 2 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, justifyContent: 'center' },
  footer: { gap: t.spacing.sm },
});
