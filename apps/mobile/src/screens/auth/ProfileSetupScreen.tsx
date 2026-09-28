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
import { useT } from '@/i18n';
import { sanitizeUsername } from '@/lib/username';

const BIO_MAX = 300;

/**
 * Ekran 39 — onboardingin son addımı: foto, istifadəçi adı, bio və icazələr.
 * Addım keçilə bilər; maraqlar artıq yadda saxlanıldığı üçün hesab hazırdır.
 */
export function ProfileSetupScreen() {
  const { t: tr } = useT('auth');
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
      alertError(error, tr('setup.photoFailed'));
    } finally {
      setUploading(false);
    }
  };

  const askLocation = async () => {
    setLocationAsked(true);
    // İcazə dialoqu yalnız bir dəfə çıxır — rədd edilsə tənzimləmələrdən açılır
    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert(tr('setup.locationDeniedTitle'), tr('setup.locationDeniedMessage'));
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
      alertError(error, tr('setup.saveFailed'));
    }
  };

  return (
    <Screen
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button block label={tr('setup.start')} loading={update.isPending} onPress={() => void save()} />
          <Button block label={tr('setup.later')} variant="ghost" onPress={finish} />
        </View>
      }
    >
      <TopBar />

      <View style={styles.body}>
        <Pill label={tr('step', { current: 3, total: 3 })} tone="green" />
        <Text variant="titleXl">{tr('setup.title')}</Text>
        <Text variant="meta">{tr('setup.sub')}</Text>

        <View style={styles.avatarRow}>
          <Avatar uri={me.data?.avatarUrl} size={88} name={me.data?.fullName} />
          <Button
            label={uploading ? tr('common:states.loading') : tr('setup.pickPhoto')}
            variant="soft"
            size="sm"
            left={<Icon name="camera" size={16} color={t.colors.green900} />}
            onPress={() => void pickAvatar()}
          />
        </View>

        <Input
          label={tr('fields.username')}
          icon="at"
          autoCapitalize="none"
          value={username ?? me.data?.username ?? ''}
          onChangeText={(v) => setUsername(sanitizeUsername(v))}
          autoCorrect={false}
          spellCheck={false}
        />
        <Input
          label={tr('setup.bio', { length: bio.length, max: BIO_MAX })}
          multiline
          numberOfLines={3}
          placeholder={tr('setup.bioPlaceholder')}
          value={bio}
          onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
        />

        <Card padded style={styles.permission}>
          <Icon name="pin" size={20} color={t.colors.green900} />
          <View style={styles.permissionText}>
            <Text variant="body">{tr('setup.locationTitle')}</Text>
            <Text variant="meta" color="muted">
              {tr('setup.locationSub')}
            </Text>
          </View>
          <Button
            label={locationAsked ? tr('setup.asked') : tr('common:location.allow')}
            variant={locationAsked ? 'soft' : 'primary'}
            size="sm"
            disabled={locationAsked}
            onPress={() => void askLocation()}
          />
        </Card>

        <View style={styles.reward}>
          <Icon name="sparkle" size={18} color={t.colors.brown700} />
          <Text variant="small" color="brown700">
            {tr('setup.reward')}
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
