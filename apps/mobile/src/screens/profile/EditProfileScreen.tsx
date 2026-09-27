import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import { Avatar, Button, Chip, Icon, Input, Photo, Screen, Text, TopBar } from '@/components';
import { useMe, useSetInterests, useSetProfileMedia, useUpdateMe } from '@/api/hooks/me';
import { useCategoryList, useRegions } from '@/api/hooks/content';
import { PICKER_OPTIONS, uploadImage } from '@/api/upload';
import { alertError } from '@/lib/errors';
import { t } from '@/theme';
import { sanitizeUsername } from '@/lib/username';
import type { AppScreenProps } from '@/navigation/types';

const BIO_MAX = 300;

/** Ekran 54 — profilin redaktəsi: cover, avatar, ad, bio, region, maraqlar. */
export function EditProfileScreen({ navigation }: AppScreenProps<'EditProfile'>) {
  const me = useMe();
  const regions = useRegions();
  const categories = useCategoryList();
  const update = useUpdateMe();
  const saveInterests = useSetInterests();
  const setAvatar = useSetProfileMedia('avatar');
  const setCover = useSetProfileMedia('cover');

  const [form, setForm] = useState<{ fullName: string; username: string; bio: string; homeRegion: string | null } | null>(null);
  const [interests, setInterests] = useState<string[] | null>(null);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);

  const profile = me.data;
  // Sahələr yalnız bir dəfə doldurulur — yazarkən server cavabı yazılanı üstələməsin
  const f = form ?? {
    fullName: profile?.fullName ?? '',
    username: profile?.username ?? '',
    bio: profile?.bio ?? '',
    homeRegion: profile?.homeRegion?.slug ?? null,
  };
  const picked = interests ?? profile?.interests.map((i) => i.slug) ?? [];

  const set = (patch: Partial<typeof f>) => setForm({ ...f, ...patch });

  const pick = async (kind: 'avatar' | 'cover') => {
    const res = await launchImageLibrary({ ...PICKER_OPTIONS, selectionLimit: 1 });
    const asset: Asset | undefined = res.assets?.[0];
    if (!asset) return;

    setUploading(kind);
    try {
      const media = await uploadImage(asset, kind);
      await (kind === 'avatar' ? setAvatar : setCover).mutateAsync(media.publicId);
    } catch (error) {
      alertError(error, 'Şəkil yüklənmədi');
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    const name = f.fullName.trim();
    if (name.length < 2) {
      Alert.alert('Ad qısadır', 'Adın ən azı 2 hərf olmalıdır');
      return;
    }
    if (f.username.trim().length < 3) {
      Alert.alert('İstifadəçi adı qısadır', 'İstifadəçi adı ən azı 3 simvol olmalıdır');
      return;
    }
    // Maraqlar ayrıca endpointdədir (PUT /me/interests) və ən azı 1 seçim tələb edir —
    // hamısını götürüb səssizcə yadda saxlamamaq əvəzinə səbəbi deyirik
    if (interests && interests.length === 0) {
      Alert.alert('Maraq seç', 'Tövsiyələr üçün ən azı 1 maraq seçilməlidir');
      return;
    }
    try {
      await update.mutateAsync({
        fullName: name,
        username: f.username.trim(),
        bio: f.bio.trim(),
        // API sahəsi `homeRegionSlug`-dır; null seçimi götürür
        homeRegionSlug: f.homeRegion,
      });
      if (interests?.length) await saveInterests.mutateAsync(interests);
      navigation.goBack();
    } catch (error) {
      alertError(error, 'Profil yadda saxlanılmadı');
    }
  };

  return (
    <Screen
      padded={false}
      footer={<Button block label="Yadda saxla" onPress={() => void save()} loading={update.isPending || saveInterests.isPending} />}
    >
      <TopBar title="Profili redaktə et" onBack={navigation.goBack} />

      <View style={styles.cover}>
        <Photo uri={profile?.coverUrl} style={styles.coverImage} radius={0} />
        <View style={styles.coverShade} />
        <Button
          label={uploading === 'cover' ? 'Yüklənir…' : 'Cover dəyiş'}
          variant="light"
          size="sm"
          left={<Icon name="camera" size={16} color={t.colors.ink} />}
          onPress={() => void pick('cover')}
          style={styles.coverButton}
        />
      </View>

      <View style={styles.avatarWrap}>
        <Avatar uri={profile?.avatarUrl} size={96} name={profile?.fullName} />
        <Button
          label={uploading === 'avatar' ? 'Yüklənir…' : 'Şəkli dəyiş'}
          variant="soft"
          size="sm"
          onPress={() => void pick('avatar')}
          style={styles.avatarButton}
        />
      </View>

      <View style={styles.form}>
        <Input label="Ad və soyad" value={f.fullName} onChangeText={(v) => set({ fullName: v })} icon="user" />
        <Input
          label="İstifadəçi adı"
          value={f.username}
          onChangeText={(v) => set({ username: sanitizeUsername(v) })}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          icon="at"
        />
        <Input
          label={`Haqqında (${f.bio.length}/${BIO_MAX})`}
          value={f.bio}
          onChangeText={(v) => set({ bio: v.slice(0, BIO_MAX) })}
          multiline
          numberOfLines={3}
          placeholder="Bir-iki cümlə ilə özün haqqında"
        />

        <Text variant="small" color="ink2" style={styles.label}>
          Ev regionu
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {regions.data?.map((r) => (
            <Chip
              key={r.slug}
              label={r.name}
              active={f.homeRegion === r.slug}
              onPress={() => set({ homeRegion: f.homeRegion === r.slug ? null : r.slug })}
            />
          ))}
        </ScrollView>

        <Text variant="small" color="ink2" style={styles.label}>
          Maraqlar
        </Text>
        <View style={styles.interestGrid}>
          {categories.data?.map((i) => (
            <Chip
              key={i.slug}
              label={i.name}
              tone="brown"
              active={picked.includes(i.slug)}
              onPress={() =>
                setInterests(picked.includes(i.slug) ? picked.filter((s) => s !== i.slug) : [...picked, i.slug])
              }
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 140 },
  coverImage: { width: '100%', height: 140 },
  coverShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,61,58,0.25)' },
  coverButton: { position: 'absolute', right: t.spacing.lg, top: t.spacing.md },
  avatarWrap: { alignItems: 'center', marginTop: -48, gap: t.spacing.sm },
  avatarButton: { alignSelf: 'center', paddingHorizontal: t.spacing.lg },
  form: { padding: t.spacing.page, gap: t.spacing.md },
  label: { marginTop: t.spacing.sm },
  chips: { gap: t.spacing.sm, paddingRight: t.spacing.page },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
});
