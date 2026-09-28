import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import { REVIEW_TAGS, XP_RULES } from '@gezgin/shared';
import { Button, Card, Chip, Icon, Loading, Photo, Screen, Text, TopBar, type IconName } from '@/components';
import { ApiError } from '@/api/client';
import { useMyReview, useWriteReview, type WrittenReview } from '@/api/hooks/social';
import { PICKER_OPTIONS, uploadImage } from '@/api/upload';
import { isGuestBlocked, promptGuestSignup } from '@/lib/errors';
import { t } from '@/theme';
import { useT } from '@/i18n';
import type { AppScreenProps } from '@/navigation/types';

const MAX_BODY = 500;
const MAX_PHOTOS = 6;

const TARGET_ICON: Record<AppScreenProps<'WriteReview'>['route']['params']['targetType'], IconName> = {
  place: 'pin',
  route: 'route',
  experience: 'sparkle',
  business: 'landmark',
};

/**
 * Ekran 27 — rəy yaz.
 *
 * Açılanda `GET /reviews/mine` yoxlanılır: rəy varsa form redaktə rejimində,
 * köhnə ulduz, mətn və teqlərlə açılır. Əvvəl form həmişə boş açılırdı və
 * boş teq çipləri ilə göndərilən yeniləmə köhnə teqləri silirdi.
 * `mine` alınmasa (şəbəkə) 409 cavabı yenə redaktəyə keçirir.
 */
export function WriteReviewScreen(props: AppScreenProps<'WriteReview'>) {
  const { targetType, target } = props.route.params;
  const { t: tr } = useT('social');
  const mine = useMyReview(targetType, target);

  if (mine.isLoading) {
    return (
      <Screen padded={false} scroll={false}>
        <TopBar title={tr('review.title')} onBack={props.navigation.goBack} />
        <Loading label={tr('common:states.loading')} />
      </Screen>
    );
  }
  return <ReviewForm {...props} initial={mine.data?.review ?? null} />;
}

function ReviewForm({ route, navigation, initial }: AppScreenProps<'WriteReview'> & { initial: WrittenReview | null }) {
  const { targetType, target, name, subtitle } = route.params;
  const { t: tr, tp: tpr } = useT('social');
  const write = useWriteReview();

  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [body, setBody] = useState(initial?.body ?? '');
  const [photos, setPhotos] = useState<Asset[]>([]);
  /** Mövcud rəyin id-si (`mine` və ya 409-dan) — göndərəndə PATCH gedir. */
  const [existing, setExisting] = useState<string | null>(initial?.publicId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingPhotos = initial?.photos.filter((p) => p.url) ?? [];

  const toggleTag = (slug: string) =>
    setTags((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));

  const pickPhotos = async () => {
    const res = await launchImageLibrary({ ...PICKER_OPTIONS, selectionLimit: MAX_PHOTOS - photos.length });
    if (res.didCancel || res.errorCode) return;
    setPhotos((prev) => [...prev, ...(res.assets ?? [])].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

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
        // Redaktədə boş mətn də göndərilir — istifadəçi mətni silibsə server də silsin
        body: existing ? body.trim() : body.trim() || undefined,
        tags,
        ...(existing ? { publicId: existing } : { photos: uploaded }),
      });

      const xp = res.rewards?.xpGained ?? 0;
      const levelUp = res.rewards?.leveledUp ? ` ${tr('shared.levelUp', { level: res.rewards.levelAfter })}` : '';
      Alert.alert(
        existing ? tr('review.updatedTitle') : tr('review.thanksTitle'),
        xp > 0
          ? `${tr('review.xpGained', { xp })}${levelUp}`
          : existing
            ? tr('review.changesSaved')
            : `${tr('review.shared')}${levelUp}`,
        [{ text: tr('common:actions.close'), onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      if (isGuestBlocked(e)) {
        promptGuestSignup(e instanceof ApiError ? e.message : undefined);
        return;
      }
      const conflictId =
        e instanceof ApiError && e.status === 409 ? (e.details as { publicId?: string } | undefined)?.publicId : undefined;
      if (conflictId) {
        setExisting(conflictId);
        setError(tr('review.conflict'));
      } else {
        setError(e instanceof ApiError ? e.message : tr('review.failed'));
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
            label={existing ? tr('review.update') : tr('review.submit')}
            disabled={rating === 0}
            loading={busy}
            onPress={() => void submit()}
            style={styles.cta}
          />
        }
      >
        <TopBar title={initial ? tr('review.editTitle') : tr('review.title')} onBack={navigation.goBack} />

        <View style={styles.body}>
          <Card padded style={styles.target}>
            <View style={styles.targetIcon}>
              <Icon name={TARGET_ICON[targetType]} size={20} color={t.colors.green900} />
            </View>
            <View style={styles.flex}>
              <Text variant="h3">{name}</Text>
              {subtitle ? <Text variant="caption">{tr('review.subtitleCountry', { subtitle })}</Text> : null}
            </View>
          </Card>

          {initial ? (
            <Text variant="small" color="brown700">
              {tr('review.alreadyWritten')}
            </Text>
          ) : null}

          <View style={styles.center}>
            <Text variant="h2">{tr('review.howWasIt')}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setRating(n)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={tpr('review.stars', n)}
                  accessibilityState={{ selected: n <= rating }}
                >
                  <Icon name="star" size={38} color={n <= rating ? t.colors.star : t.colors.line} filled />
                </Pressable>
              ))}
            </View>
            <Text variant="small" color="muted">
              {rating >= 1 && rating <= 5 ? tr(`review.rating.${rating}`) : tr('review.pickStars')}
            </Text>
          </View>

          <View style={styles.tags}>
            {/* Etiket kodla tərcümə olunur; tərcüməsi olmayan yeni kod paylaşılan azərbaycanca adla görünür */}
            {Object.entries(REVIEW_TAGS).map(([slug, label]) => (
              <Chip
                key={slug}
                label={tr(`review.tags.${slug}`, { defaultValue: label })}
                active={tags.includes(slug)}
                onPress={() => toggleTag(slug)}
              />
            ))}
          </View>

          <View>
            <TextInput
              style={styles.input}
              placeholder={tr('review.placeholder')}
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

          {existing ? (
            // Fotolar yalnız yaradarkən əlavə olunur — redaktədə mövcudları göstəririk
            existingPhotos.length ? (
              <View style={styles.existingPhotos}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
                  {existingPhotos.map((p, i) => (
                    <Photo key={`${p.url}-${i}`} uri={p.url} style={styles.photo} radius={t.radius.md} />
                  ))}
                </ScrollView>
                <Text variant="caption">{tr('review.photosLocked')}</Text>
              </View>
            ) : null
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
              {photos.map((p, i) => (
                <View key={`${p.uri}-${i}`}>
                  <Photo uri={p.uri} style={styles.photo} radius={t.radius.md} />
                  <Pressable
                    style={styles.remove}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={tr('shared.removePhoto')}
                    onPress={() => removePhoto(i)}
                  >
                    <Icon name="x" size={12} color="#fff" strokeWidth={3} />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <Pressable
                  style={[styles.photo, styles.addPhoto]}
                  onPress={() => void pickPhotos()}
                  accessibilityRole="button"
                  accessibilityLabel={tr('review.addPhoto')}
                >
                  <Icon name="camera" size={22} color={t.colors.green900} />
                  <Text variant="caption" color="green900">
                    {tr('review.addPhoto')}
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          )}

          <Card padded style={styles.xp}>
            <Icon name="sparkle" size={18} color={t.colors.brown700} />
            <Text variant="small" color="brown700" style={styles.flex}>
              {existing ? tr('review.editNoXp') : tr('review.xpHint', { xp: XP_RULES.review_written.xp })}
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
  existingPhotos: { gap: t.spacing.sm },
  photo: { width: 96, height: 96, backgroundColor: t.colors.bg2 },
  remove: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  addPhoto: {
    borderRadius: t.radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.colors.green900,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  xp: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, backgroundColor: t.colors.brown100, borderColor: t.colors.brown100 },
  cta: { width: '100%' },
});
