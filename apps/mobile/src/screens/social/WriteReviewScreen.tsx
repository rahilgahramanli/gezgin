import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import { REVIEW_TAGS, XP_RULES } from '@gezgin/shared';
import { Button, Card, Chip, Icon, Photo, Screen, Text, TopBar } from '@/components';
import { ApiError } from '@/api/client';
import { useWriteReview } from '@/api/hooks/social';
import { PICKER_OPTIONS, uploadImage } from '@/api/upload';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

const RATING_LABEL = ['', 'Pis', 'Orta', 'Yaxşı', 'Çox yaxşı', 'Möhtəşəm'];
const MAX_BODY = 500;
const MAX_PHOTOS = 6;

/** Ekran 27 — rəy yaz. Eyni obyektə ikinci rəy 409 qaytarır → mövcud rəy redaktə olunur. */
export function WriteReviewScreen({ route, navigation }: AppScreenProps<'WriteReview'>) {
  const { targetType, target, name, subtitle } = route.params;
  const write = useWriteReview();

  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<Asset[]>([]);
  /** 409-dan sonra mövcud rəyin id-si — göndərəndə PATCH gedir. */
  const [existing, setExisting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (slug: string) =>
    setTags((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));

  const pickPhotos = async () => {
    const res = await launchImageLibrary({ ...PICKER_OPTIONS, selectionLimit: MAX_PHOTOS - photos.length });
    if (res.didCancel || res.errorCode) return;
    setPhotos((prev) => [...prev, ...(res.assets ?? [])].slice(0, MAX_PHOTOS));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      if (!existing) for (const p of photos) uploaded.push((await uploadImage(p, 'review')).publicId);

      const res = await write.mutateAsync({
        targetType,
        target,
        rating,
        body: body.trim() || undefined,
        tags,
        ...(existing ? { publicId: existing } : { photos: uploaded }),
      });
      Alert.alert(
        existing ? 'Rəy yeniləndi' : 'Təşəkkürlər!',
        res.rewards?.xpGained ? `Rəyin üçün +${res.rewards.xpGained} XP qazandın` : 'Rəyin paylaşıldı',
        [{ text: 'Bağla', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      const conflictId =
        e instanceof ApiError && e.status === 409 ? (e.details as { publicId?: string } | undefined)?.publicId : undefined;
      if (conflictId) {
        setExisting(conflictId);
        setError('Bura artıq rəy yazmısan — göndərsən, köhnə rəyin yenilənəcək.');
      } else {
        setError(e instanceof ApiError ? e.message : 'Rəy göndərilmədi — yenidən cəhd edin');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        padded={false}
        footer={
          <Button
            label={existing ? 'Rəyi yenilə' : 'Rəyi göndər'}
            disabled={rating === 0}
            loading={busy}
            onPress={() => void submit()}
          />
        }
      >
        <TopBar title="Rəy yaz" onBack={navigation.goBack} />

        <View style={styles.body}>
          <Card padded style={styles.target}>
            <View style={styles.targetIcon}>
              <Icon name="pin" size={20} color={t.colors.green900} />
            </View>
            <View style={styles.flex}>
              <Text variant="h3">{name}</Text>
              {subtitle ? <Text variant="caption">{subtitle}, Azərbaycan</Text> : null}
            </View>
          </Card>

          <View style={styles.center}>
            <Text variant="h2">Səyahətin necə keçdi?</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityLabel={`${n} ulduz`}>
                  <Icon name="star" size={38} color={n <= rating ? t.colors.star : t.colors.line} filled />
                </Pressable>
              ))}
            </View>
            <Text variant="small" color="muted">
              {RATING_LABEL[rating] || 'Ulduz seç'}
            </Text>
          </View>

          <View style={styles.tags}>
            {Object.entries(REVIEW_TAGS).map(([slug, label]) => (
              <Chip key={slug} label={label} active={tags.includes(slug)} onPress={() => toggleTag(slug)} />
            ))}
          </View>

          <View>
            <TextInput
              style={styles.input}
              placeholder="Təəssüratlarını yaz — başqa gezginlərə kömək edəcək"
              placeholderTextColor={t.colors.muted}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={MAX_BODY}
            />
            <Text variant="caption" style={styles.counter}>
              {body.length} / {MAX_BODY}
            </Text>
          </View>

          {existing ? null : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
              {photos.map((p, i) => (
                <Photo key={`${p.uri}-${i}`} uri={p.uri} style={styles.photo} radius={t.radius.md} />
              ))}
              {photos.length < MAX_PHOTOS ? (
                <Pressable style={[styles.photo, styles.addPhoto]} onPress={() => void pickPhotos()}>
                  <Icon name="camera" size={22} color={t.colors.green900} />
                  <Text variant="caption" color="green900">
                    Foto əlavə et
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          )}

          <Card padded style={styles.xp}>
            <Icon name="sparkle" size={18} color={t.colors.brown700} />
            <Text variant="small" color="brown700" style={styles.flex}>
              {existing ? 'Redaktə XP vermir — XP ilk rəy üçündür' : `Rəyin üçün +${XP_RULES.review_written.xp} XP`}
            </Text>
          </Card>

          {error ? (
            <Text variant="small" color={existing ? 'brown700' : 'danger'}>
              {error}
            </Text>
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.xl },
  target: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  targetIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  center: { alignItems: 'center', gap: t.spacing.sm },
  stars: { flexDirection: 'row', gap: t.spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  input: {
    minHeight: 120, padding: t.spacing.lg, borderRadius: t.radius.md, backgroundColor: t.colors.bg2,
    color: t.colors.ink, fontSize: 15, lineHeight: 22, textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', marginTop: 4 },
  photos: { gap: t.spacing.sm },
  photo: { width: 96, height: 96, backgroundColor: t.colors.bg2 },
  addPhoto: {
    borderRadius: t.radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.colors.green900,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  xp: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, backgroundColor: t.colors.brown100, borderColor: t.colors.brown100 },
});
