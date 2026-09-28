import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Chip, EmptyState, Icon, ListSkeleton, Photo, Pill, Rating, Screen, Text, TopBar } from '@/components';
import { useAllReviews, useReviewSummary, useToggleHelpful, type ReviewSort } from '@/api/hooks/details';
import { timeAgo } from '@/lib/time';
import { errorText } from '@/lib/errors';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Sıralama çipləri — mətn `reviews.sort.<açar>`, render zamanı tərcümə olunur. */
const SORTS: ReviewSort[] = ['newest', 'highest', 'lowest', 'helpful'];

/** Ekran 47 — bütün rəylər: bölgü, sıralama, rəy kartları. */
export function ReviewsAllScreen({ route, navigation }: AppScreenProps<'ReviewsAll'>) {
  const { t: tr, tp: tpr } = useT('explore');
  const { targetType, target, name } = route.params;
  const [sort, setSort] = useState<ReviewSort>('newest');
  const summary = useReviewSummary(targetType, target);
  const reviews = useAllReviews(targetType, target, sort);
  const helpful = useToggleHelpful(targetType, target);

  return (
    <Screen
      padded={false}
      footer={
        <Button
          block
          label={tr('reviews.write')}
          left={<Icon name="edit" size={18} color="#fff" />}
          onPress={() => navigation.navigate('WriteReview', { targetType, target, name })}
        />
      }
    >
      <TopBar title={tr('reviews.title')} onBack={navigation.goBack} />

      <Card padded style={styles.summary}>
        <View style={styles.score}>
          <Text variant="titleXl">{(summary.data?.average ?? 0).toFixed(1)}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Icon
                key={n}
                name="star"
                size={13}
                color={n <= Math.round(summary.data?.average ?? 0) ? t.colors.star : t.colors.line}
                filled
              />
            ))}
          </View>
          <Text variant="meta" color="muted">
            {tpr('units.reviews', summary.data?.total ?? 0)}
          </Text>
        </View>

        <View style={styles.bars}>
          {(summary.data?.breakdown ?? []).map((b) => (
            <View key={b.star} style={styles.barRow}>
              <Text variant="meta" color="muted" style={styles.barStar}>
                {b.star}★
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${b.percent}%` }]} />
              </View>
              <Text variant="meta" color="muted" style={styles.barPercent}>
                {b.percent}%
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sorts}>
        {SORTS.map((s) => (
          <Chip key={s} label={tr(`reviews.sort.${s}`)} active={sort === s} onPress={() => setSort(s)} />
        ))}
      </ScrollView>

      <View style={styles.list}>
        {reviews.isLoading ? (
          <ListSkeleton rows={4} thumb={44} />
        ) : reviews.error && !reviews.data ? (
          <EmptyState
            icon="wifiOff"
            title={tr('reviews.loadFailed')}
            message={errorText(reviews.error, tr('common:states.tryLater'))}
            action={<Button label={tr('common:actions.retry')} onPress={() => void reviews.refetch()} />}
          />
        ) : !reviews.data?.data.length ? (
          <EmptyState
            icon="star"
            title={tr('reviews.empty')}
            message={tr('reviews.emptyAllMessage')}
          />
        ) : (
          reviews.data.data.map((r) => (
            <View key={r.publicId} style={styles.review}>
              <Avatar uri={r.author.avatarUrl} size={44} name={r.author.fullName} />
              <View style={styles.reviewBody}>
                <View style={styles.reviewHead}>
                  <Text variant="body" style={styles.reviewName}>
                    {r.author.fullName}
                  </Text>
                  {r.author.isLocalExpert ? <Pill label="Expert" tone="brown" /> : null}
                </View>
                <View style={styles.reviewMeta}>
                  <Rating value={r.rating} size={13} />
                  <Text variant="meta" color="muted">
                    {tr('reviews.level', { level: r.author.level })} · {timeAgo(r.createdAt)}
                  </Text>
                </View>
                {r.body ? <Text variant="body">{r.body}</Text> : null}
                {r.photos?.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
                    {r.photos.map((ph, i) => (
                      <Photo key={`${r.publicId}-${i}`} uri={ph.url} style={styles.photo} radius={10} />
                    ))}
                  </ScrollView>
                ) : null}
                {!r.isMine ? (
                  <Pressable
                    style={styles.helpful}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !!r.markedHelpful }}
                    accessibilityLabel={tr(r.markedHelpful ? 'reviews.helpfulMarkedA11y' : 'reviews.helpfulA11y', {
                      n: r.helpfulCount ?? 0,
                    })}
                    onPress={() => helpful.mutate({ publicId: r.publicId, helpful: !r.markedHelpful })}
                  >
                    <Icon name="check" size={14} color={r.markedHelpful ? t.colors.green900 : t.colors.muted} />
                    <Text variant="meta" color={r.markedHelpful ? 'green900' : 'muted'}>
                      {tr('reviews.helpful')}
                      {r.helpfulCount ? ` · ${r.helpfulCount}` : ''}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: t.spacing.xl, margin: t.spacing.page, marginTop: 0 },
  score: { alignItems: 'center', gap: 4, minWidth: 96 },
  bars: { flex: 1, justifyContent: 'center', gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  barStar: { width: 24 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: t.colors.bg2, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: t.colors.star },
  barPercent: { width: 34, textAlign: 'right' },
  sorts: { gap: t.spacing.sm, paddingHorizontal: t.spacing.page },
  stars: { flexDirection: 'row', gap: 2 },
  list: { padding: t.spacing.page, gap: t.spacing.xl },
  review: { flexDirection: 'row', gap: t.spacing.md },
  reviewBody: { flex: 1, gap: 4 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  reviewName: { fontWeight: '600' },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  photos: { gap: t.spacing.sm, paddingVertical: 4 },
  photo: { width: 72, height: 72 },
  helpful: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
});
