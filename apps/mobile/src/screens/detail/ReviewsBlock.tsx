import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { XP_RULES } from '@gezgin/shared';
import { Avatar, Button, Card, Icon, Pill, Rating, SectionHead, Text } from '@/components';
import { useReviewSummary, useReviews } from '@/api/hooks/details';
import type { ReviewTargetType } from '@/api/hooks/social';
import { errorText } from '@/lib/errors';
import { t } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

/**
 * Detal ekranlarının rəy bloku (ekran 13, 15, 17): xülasə, son 3 rəy,
 * "Hamısına bax" → ekran 47 və "Rəy yaz" → ekran 27.
 *
 * Əvvəl yalnız məkan detalında idi — təcrübə və marşrut reytinq göstərirdi,
 * amma rəyləri oxumaq və ya yazmaq mümkün deyildi.
 */
export function ReviewsBlock({
  targetType,
  target,
  name,
  subtitle,
}: {
  targetType: ReviewTargetType;
  target: string;
  name: string;
  subtitle?: string;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const summary = useReviewSummary(targetType, target);
  const reviews = useReviews(targetType, target);

  const list = reviews.data?.data ?? [];
  const total = summary.data?.total ?? list.length;
  const average = summary.data?.average ?? 0;

  const write = () => navigation.navigate('WriteReview', { targetType, target, name, subtitle });
  const all = () => navigation.navigate('ReviewsAll', { targetType, target, name });

  // Yüklənərkən yer tutmuruq — detal artıq göstərilir, rəylər sonradan gəlir
  if (reviews.isLoading && summary.isLoading) return null;

  if (reviews.error && !reviews.data) {
    // "Hələ rəy yoxdur" yazmaq yanlış olardı — rəylər sadəcə yüklənmədi
    return (
      <Card padded style={styles.empty}>
        <Text variant="h3">Rəylər yüklənmədi</Text>
        <Text variant="small" color="ink2">
          {errorText(reviews.error, 'Bir az sonra yenidən cəhd et.')}
        </Text>
        <Button label="Yenidən cəhd et" variant="soft" size="sm" onPress={() => void reviews.refetch()} />
      </Card>
    );
  }

  if (!list.length) {
    // Rəy yoxdursa da yazmaq mümkün olmalıdır — ekran 27-yə giriş budur
    return (
      <Card padded style={styles.empty}>
        <Text variant="h3">Hələ rəy yoxdur</Text>
        <Text variant="small" color="ink2">
          Burada olmusan? Təcrübəni bölüş — rəy +{XP_RULES.review_written.xp} XP qazandırır.
        </Text>
        <Button label="İlk rəyi sən yaz" variant="soft" size="sm" onPress={write} />
      </Card>
    );
  }

  return (
    <View>
      <SectionHead title={`Rəylər (${total})`} actionLabel="Hamısına bax" onAction={all} />
      <View style={styles.list}>
        <Card padded style={styles.summary} onPress={all}>
          <Text variant="titleLg">{average.toFixed(1)}</Text>
          <View style={styles.flex}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Icon
                  key={n}
                  name="star"
                  size={14}
                  color={n <= Math.round(average) ? t.colors.star : t.colors.line}
                  filled
                />
              ))}
            </View>
            <Text variant="caption">{total} rəy əsasında</Text>
          </View>
          <Icon name="chevronRight" size={18} color={t.colors.muted} />
        </Card>

        {list.slice(0, 3).map((r) => (
          <Card key={r.publicId} padded style={styles.review}>
            <View style={styles.reviewHead}>
              <Avatar uri={r.author.avatarUrl} size={36} name={r.author.fullName} />
              <View style={styles.flex}>
                <View style={styles.reviewAuthor}>
                  <Text variant="h3" numberOfLines={1} style={styles.shrink}>
                    {r.author.fullName}
                  </Text>
                  {r.author.isLocalExpert ? <Pill label="Local Expert" tone="brown" /> : null}
                </View>
                <Text variant="caption">Level {r.author.level}</Text>
              </View>
              <Rating value={r.rating} />
            </View>
            {r.body ? (
              <Text variant="small" color="ink2" style={styles.reviewBody} numberOfLines={5}>
                {r.body}
              </Text>
            ) : null}
          </Card>
        ))}

        <Button
          label="Rəy yaz"
          variant="outline"
          left={<Icon name="edit" size={18} color={t.colors.green900} />}
          onPress={write}
          style={styles.write}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: t.spacing.md },
  empty: { gap: t.spacing.sm },
  summary: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  stars: { flexDirection: 'row', gap: 2 },
  review: { gap: t.spacing.sm },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  reviewAuthor: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  reviewBody: { lineHeight: 20 },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  write: { alignSelf: 'stretch' },
});
