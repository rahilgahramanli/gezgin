import { useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import { XP_RULES } from '@gezgin/shared';
import { Avatar, Button, Card, Icon, Input, Photo, Text, type IconName } from '@/components';
import { ApiError } from '@/api/client';
import { isGuestBlocked, promptGuestSignup } from '@/lib/errors';
import { usePlaces, useRoutes } from '@/api/hooks/content';
import { useMe } from '@/api/hooks/me';
import { useCreatePost, useCreateStory, type PostVisibility } from '@/api/hooks/social';
import { PICKER_OPTIONS, uploadImage } from '@/api/upload';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

const VISIBILITY: Array<{ key: PostVisibility; label: string }> = [
  { key: 'public', label: 'Hamı' },
  { key: 'followers', label: 'İzləyicilər' },
  { key: 'private', label: 'Yalnız mən' },
];

interface Picked {
  slug: string;
  name: string;
  subtitle?: string;
}

/**
 * Ekran 26 — paylaş. `mode: 'story'` eyni ekranda hekayə yaradır (bir foto,
 * başlıq, məkan). Video MVP-də yoxdur — TECH-PLAN §11 "yalnız foto".
 */
export function CreatePostScreen({ route, navigation }: AppScreenProps<'CreatePost'>) {
  const isStory = route.params?.mode === 'story';
  const me = useMe();
  const create = useCreatePost();
  const createStory = useCreateStory();

  const [body, setBody] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [place, setPlace] = useState<Picked | null>(route.params?.place ?? null);
  const [linkedRoute, setLinkedRoute] = useState<Picked | null>(null);
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [picker, setPicker] = useState<'place' | 'route' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxPhotos = isStory ? 1 : 10;
  const canSubmit = !busy && (isStory ? assets.length === 1 : body.trim().length > 0 || assets.length > 0);

  const pickPhotos = async () => {
    const res = await launchImageLibrary({ ...PICKER_OPTIONS, selectionLimit: maxPhotos - (isStory ? 0 : assets.length) });
    if (res.didCancel) return;
    if (res.errorCode) {
      setError(res.errorMessage ?? 'Qalereya açılmadı');
      return;
    }
    const picked = res.assets ?? [];
    setAssets((prev) => (isStory ? picked.slice(0, 1) : [...prev, ...picked].slice(0, maxPhotos)));
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      // Ardıcıl yükləmə — karusel sırası seçim sırası ilə eyni qalsın
      const uploaded: string[] = [];
      for (const asset of assets) uploaded.push((await uploadImage(asset, 'post')).publicId);

      if (isStory) {
        const media = uploaded[0];
        if (!media) return;
        await createStory.mutateAsync({ media, caption: body.trim() || undefined, place: place?.slug });
        Alert.alert('Hekayə paylaşıldı', '24 saat ərzində izləyicilərin görəcək.');
        navigation.goBack();
        return;
      }

      const post = await create.mutateAsync({
        body: body.trim() || undefined,
        media: uploaded,
        place: place?.slug,
        route: linkedRoute?.slug,
        visibility,
      });
      if (post.rewards?.xpGained) {
        Alert.alert(`+${post.rewards.xpGained} XP`, post.rewards.leveledUp ? `Level ${post.rewards.levelAfter}-ə yüksəldin!` : 'Paylaşım üçün təşəkkürlər');
      }
      navigation.replace('PostDetail', { publicId: post.publicId });
    } catch (e) {
      // Qonaq paylaşa bilməz — səbəbi deyib qeydiyyata yönləndiririk
      if (isGuestBlocked(e)) promptGuestSignup('Paylaşım etmək üçün hesab yaratmalısınız');
      setError(e instanceof ApiError ? e.message : 'Paylaşım alınmadı — yenidən cəhd edin');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text variant="body" color="muted" onPress={navigation.goBack}>
          Ləğv et
        </Text>
        <Text variant="h3">{isStory ? 'Hekayə' : 'Paylaş'}</Text>
        <Button label="Paylaş" size="xs" disabled={!canSubmit} loading={busy} onPress={() => void submit()} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.author}>
            <Avatar uri={me.data?.avatarUrl} size={44} name={me.data?.fullName} />
            <View style={styles.flex}>
              <Text variant="h3">{me.data?.username ?? ''}</Text>
              {isStory ? (
                <Text variant="caption">24 saat görünəcək</Text>
              ) : (
                <View style={styles.visibility}>
                  {VISIBILITY.map((v) => (
                    <Pressable
                      key={v.key}
                      onPress={() => setVisibility(v.key)}
                      style={[styles.visChip, visibility === v.key && styles.visChipActive]}
                    >
                      <Text variant="caption" color={visibility === v.key ? 'paper' : 'ink2'}>
                        {v.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          <TextInput
            style={styles.body}
            placeholder={isStory ? 'Başlıq əlavə et…' : 'Nə kəşf etdin? #heşteq əlavə et'}
            placeholderTextColor={t.colors.muted}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={isStory ? 255 : 2200}
          />

          {assets.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
              {assets.map((a, i) => (
                <View key={`${a.uri}-${i}`}>
                  <Photo uri={a.uri} style={isStory ? styles.storyPhoto : styles.photo} radius={t.radius.md} />
                  <Pressable
                    style={styles.remove}
                    hitSlop={8}
                    accessibilityLabel="Fotonu sil"
                    onPress={() => setAssets((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Icon name="x" size={12} color="#fff" strokeWidth={3} />
                  </Pressable>
                </View>
              ))}
              {assets.length < maxPhotos ? (
                <Pressable
                  style={[styles.photo, styles.addPhoto]}
                  onPress={() => void pickPhotos()}
                  accessibilityLabel="Daha çox foto"
                >
                  <Icon name="plus" size={22} color={t.colors.green900} />
                </Pressable>
              ) : null}
            </ScrollView>
          ) : null}

          <View style={styles.attach}>
            <Attach icon="image" label="Foto" onPress={() => void pickPhotos()} />
            {!isStory ? <Attach icon="route" label="Marşrut" onPress={() => setPicker('route')} /> : null}
            <Attach icon="pin" label="Yerləşmə" onPress={() => setPicker('place')} />
          </View>

          {place ? (
            <Selected icon="pin" title="Yerləşmə" value={place.name} subtitle={place.subtitle} onClear={() => setPlace(null)} />
          ) : null}
          {linkedRoute ? (
            <Selected
              icon="route"
              title="Marşruta bağla"
              value={linkedRoute.name}
              subtitle={linkedRoute.subtitle}
              onClear={() => setLinkedRoute(null)}
            />
          ) : null}

          {!isStory ? (
            <Card padded style={styles.xp}>
              <Icon name="sparkle" size={18} color={t.colors.brown700} />
              <Text variant="small" color="brown700" style={styles.flex}>
                {assets.length
                  ? `Bu paylaşım üçün +${XP_RULES.media_shared.xp} XP qazanacaqsan`
                  : `Foto əlavə et — +${XP_RULES.media_shared.xp} XP qazan`}
              </Text>
            </Card>
          ) : null}

          {error ? (
            <Text variant="small" color="danger">
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {picker ? (
        <PickerSheet
          kind={picker}
          onClose={() => setPicker(null)}
          onPick={(x) => {
            if (picker === 'place') setPlace(x);
            else setLinkedRoute(x);
            setPicker(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Attach({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.attachItem} onPress={onPress}>
      <Icon name={icon} size={20} color={t.colors.green900} />
      <Text variant="small" color="green900" style={styles.bold}>
        {label}
      </Text>
    </Pressable>
  );
}

function Selected({
  icon,
  title,
  value,
  subtitle,
  onClear,
}: {
  icon: IconName;
  title: string;
  value: string;
  subtitle?: string;
  onClear: () => void;
}) {
  return (
    <Card padded style={styles.selected}>
      <View style={styles.selectedIcon}>
        <Icon name={icon} size={18} color={t.colors.green900} />
      </View>
      <View style={styles.flex}>
        <Text variant="caption">{title}</Text>
        <Text variant="h3" numberOfLines={1}>
          {value}
        </Text>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
      <Pressable onPress={onClear} hitSlop={10}>
        <Icon name="x" size={16} color={t.colors.muted} />
      </Pressable>
    </Card>
  );
}

/** Azərbaycan hərfləri ilə və onlarsız yazılışı eyniləşdirir ("Xinaliq" → "Xınalıq"). */
const fold = (s: string) =>
  s
    .toLocaleLowerCase('az')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g');

/**
 * Məkan/marşrut seçimi. Hazırkı həcmdə (onlarla obyekt) müştəri tərəfində
 * süzülür; kontent yüzlərlə olanda `/search`-ə keçmək lazımdır.
 */
function PickerSheet({ kind, onPick, onClose }: { kind: 'place' | 'route'; onPick: (x: Picked) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const places = usePlaces({ limit: 50 });
  const routes = useRoutes({ limit: 50 });

  const items: Picked[] = useMemo(() => {
    const all: Picked[] =
      kind === 'place'
        ? (places.data?.data ?? []).map((p) => ({ slug: p.slug, name: p.name, subtitle: p.region.name }))
        : (routes.data?.data ?? []).map((r) => ({ slug: r.slug, name: r.title, subtitle: `${r.days} gün · ${r.region.name}` }));
    const needle = fold(q.trim());
    return needle ? all.filter((x) => fold(`${x.name} ${x.subtitle ?? ''}`).includes(needle)) : all;
  }, [kind, q, places.data, routes.data]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text variant="body" color="muted" onPress={onClose}>
            Bağla
          </Text>
          <Text variant="h3">{kind === 'place' ? 'Yerləşmə' : 'Marşruta bağla'}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.pickerSearch}>
          <Input icon="search" placeholder={kind === 'place' ? 'Məkan axtar' : 'Marşrut axtar'} value={q} onChangeText={setQ} />
        </View>
        <FlatList
          data={items}
          keyExtractor={(x) => x.slug}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.pickerList}
          renderItem={({ item }) => (
            <Pressable style={styles.pickerRow} onPress={() => onPick(item)}>
              <Icon name={kind === 'place' ? 'pin' : 'route'} size={18} color={t.colors.green900} />
              <View style={styles.flex}>
                <Text variant="h3">{item.name}</Text>
                {item.subtitle ? <Text variant="caption">{item.subtitle}</Text> : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text variant="small" color="muted" center>
              Nəticə yoxdur
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.colors.bg },
  flex: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: t.spacing.page, paddingVertical: t.spacing.md,
    borderBottomWidth: 1, borderBottomColor: t.colors.line,
  },
  headerSpacer: { width: 40 },
  content: { padding: t.spacing.page, gap: t.spacing.lg },
  author: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  visibility: { flexDirection: 'row', gap: 6, marginTop: 4 },
  visChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: t.radius.pill, backgroundColor: t.colors.bg2 },
  visChipActive: { backgroundColor: t.colors.green900 },
  body: { minHeight: 110, fontSize: 17, lineHeight: 24, color: t.colors.ink, textAlignVertical: 'top' },
  photos: { gap: t.spacing.sm },
  photo: { width: 96, height: 96, backgroundColor: t.colors.bg2 },
  storyPhoto: { width: 150, height: 260, backgroundColor: t.colors.bg2 },
  addPhoto: {
    borderRadius: t.radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.colors.green900,
    alignItems: 'center', justifyContent: 'center',
  },
  remove: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  attach: {
    flexDirection: 'row', gap: t.spacing.lg, paddingVertical: t.spacing.md,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.colors.line,
  },
  attachItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bold: { fontWeight: '600' },
  selected: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  selectedIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  xp: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, backgroundColor: t.colors.brown100, borderColor: t.colors.brown100 },
  pickerSearch: { padding: t.spacing.page, paddingBottom: 0 },
  pickerList: { padding: t.spacing.page, gap: 2 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.md },
});
