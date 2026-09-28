import { StyleSheet, View } from 'react-native';
import {
  Avatar, Button, Card, DetailSkeleton, ErrorState, HeroScreen, Icon, Photo, Pill, Progress, Rating, SectionHead, Text,
} from '@/components';
import { useExperienceDetail, useToggleSaved } from '@/api/hooks/details';
import { durationLabel } from '@/lib/labels';
import { shareItem } from '@/lib/share';
import { bakuDate, bakuTime } from '@/lib/time';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';
import { ReviewsBlock } from './ReviewsBlock';

const HERO_HEIGHT = 300;


/** Ekran 17 — təcrübə detalı, 80/20 gəlir bölgüsü ilə. */
export function ExperienceDetailScreen({ route, navigation }: AppScreenProps<'ExperienceDetail'>) {
  const { t: tr, tp: tpr } = useT('explore');
  const { slug } = route.params;
  const detail = useExperienceDetail(slug);
  const save = useToggleSaved('experience', slug);

  if (!detail.data) {
    return detail.error && !detail.isFetching ? (
      <ErrorState error={detail.error} onRetry={() => void detail.refetch()} onBack={navigation.goBack} />
    ) : (
      <DetailSkeleton onBack={navigation.goBack} />
    );
  }
  const e = detail.data;

  return (
    <HeroScreen
      heroHeight={HERO_HEIGHT}
      title={e.title}
      onBack={navigation.goBack}
      actions={[
        {
          icon: 'heart',
          label: e.isSaved ? tr('experience.unsave') : tr('experience.save'),
          active: e.isSaved,
          onPress: () => save.mutate(!e.isSaved),
        },
        { icon: 'share', label: tr('common:actions.share'), onPress: () => void shareItem('experience', slug, e.title) },
      ]}
      footer={
        <>
          {e.nextAvailable ? (
            <Text variant="caption" center style={styles.availability}>
              {tr('experience.nextDate', {
                date: bakuDate(e.nextAvailable.startAt),
                time: bakuTime(e.nextAvailable.startAt),
              })}
              {' · '}
              {tpr('experience.seatsLeft', e.nextAvailable.seatsLeft)}
            </Text>
          ) : null}
          <Button
            label={tr('experience.book')}
            onPress={() => navigation.navigate('Booking', { experience: slug })}
            style={styles.ctaButton}
          />
        </>
      }
      hero={
        <>
          <Photo uri={e.photos[0]?.url} style={styles.heroImage} radius={0} />
          <View style={styles.heroShade} />
          <View style={styles.heroText}>
            <Pill label={tr('experience.local')} tone="brown" />
            <Text variant="titleXl" style={styles.onPhoto}>
              {e.title}
            </Text>
            <Text variant="small" style={styles.onPhotoMeta}>
              {e.region.name}
              {e.durationText ? ` · ${durationLabel(e.durationText)}` : ''}
            </Text>
          </View>
        </>
      }
    >
      <View style={styles.body}>
        <View style={styles.priceRow}>
          <View>
            <Text variant="titleLg" color="green900">
              {e.pricing.priceAzn} AZN
            </Text>
            <Text variant="caption">{tr('experience.perPerson')}</Text>
          </View>
          {e.ratingCount > 0 ? <Rating value={e.rating} count={e.ratingCount} size={18} /> : null}
        </View>

        {/* Bron əsas hərəkətdir (alt panel); səyahət planına əlavə etmək ikinci dərəcəli */}
        <Button
          label={tr('addToTrip')}
          variant="soft"
          size="sm"
          left={<Icon name="plus" size={16} color={t.colors.green900} />}
          onPress={() => navigation.navigate('AddToPlan', { type: 'experience', slug, name: e.title })}
          style={styles.planButton}
        />

        <Card padded style={styles.expert}>
          <Avatar uri={e.expert.avatarUrl} size={48} name={e.expert.fullName} />
          <View style={styles.flex}>
            <View style={styles.expertName}>
              <Text variant="h3" numberOfLines={1}>
                {e.expert.fullName}
              </Text>
              <Pill label="Local Expert" tone="brown" />
            </View>
            <Text variant="caption">
              ★ {e.expert.rating.toFixed(1)} · {tpr('experience.expertExperiences', e.expert.experienceCount)}
              {e.expert.languages.length ? ` · ${e.expert.languages.join(', ').toUpperCase()}` : ''}
            </Text>
          </View>
        </Card>

        {e.includes.length ? (
          <View>
            <SectionHead title={tr('experience.includes')} />
            <View style={styles.includes}>
              {e.includes.map((i) => (
                <View key={i.code} style={styles.include}>
                  <View style={styles.includeIcon}>
                    <Icon name="check" size={16} color={t.colors.green900} strokeWidth={2.4} />
                  </View>
                  <Text variant="small">{i.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Ekran 17-dəki şəffaf gəlir bölgüsü */}
        <Card padded style={styles.split}>
          <View style={styles.splitHead}>
            <Text variant="h3">{tr('experience.expertEarns')}</Text>
            <Text variant="h3" color="brown700">
              {e.pricing.expertEarnsAzn} AZN
            </Text>
          </View>
          <Progress percent={Math.round(e.pricing.expertRate * 100)} tone="brown" />
          <Text variant="caption">
            {tr('experience.split', {
              expert: Math.round(e.pricing.expertRate * 100),
              platform: Math.round(e.pricing.platformRate * 100),
              fee: e.pricing.platformFeeAzn,
            })}
          </Text>
        </Card>

        {/* Gezgin qazancı — XP mükafatları */}
        <Card padded style={styles.rewards}>
          <Text variant="h3">{tr('experience.rewards')}</Text>
          <View style={styles.rewardRow}>
            <Reward value={`+${e.gezginRewards.experienceXp}`} label={tr('experience.rewardExperience')} />
            <Reward value={`+${e.gezginRewards.bookingXp}`} label={tr('experience.rewardBooking')} />
            <Reward value={`+${e.gezginRewards.reviewXp}`} label={tr('experience.rewardReview')} />
          </View>
        </Card>

        {e.description ? (
          <View>
            <SectionHead title={tr('experience.about')} />
            <Text variant="body" color="ink2" style={styles.description}>
              {e.description}
            </Text>
          </View>
        ) : null}

        {e.meetingPoint ? (
          <View style={styles.meeting}>
            <Icon name="pin" size={18} color={t.colors.green900} />
            <View style={styles.flex}>
              <Text variant="small" style={styles.bold}>
                {tr('experience.meetingPoint')}
              </Text>
              <Text variant="meta">{e.meetingPoint}</Text>
            </View>
          </View>
        ) : null}

        <ReviewsBlock targetType="experience" target={slug} name={e.title} subtitle={e.region.name} />
      </View>
    </HeroScreen>
  );
}

function Reward({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.reward}>
      <Text variant="h2" color="green900">
        {value}
      </Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroImage: { width: '100%', height: HERO_HEIGHT },
  heroShade: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,20,20,0.36)',
  },
  heroText: { position: 'absolute', left: t.spacing.page, right: t.spacing.page, bottom: t.spacing.xl, gap: 6 },
  onPhoto: { color: '#fff' },
  onPhotoMeta: { color: 'rgba(255,255,255,0.92)' },
  body: { paddingHorizontal: t.spacing.page, paddingTop: t.spacing.lg, gap: t.spacing.lg },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expert: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  expertName: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  includes: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md },
  include: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '46%' },
  includeIcon: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: t.colors.green100, alignItems: 'center', justifyContent: 'center',
  },
  split: { gap: t.spacing.sm },
  splitHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rewards: { gap: t.spacing.md },
  rewardRow: { flexDirection: 'row' },
  reward: { flex: 1, alignItems: 'center' },
  description: { lineHeight: 23 },
  meeting: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  bold: { fontWeight: '600' },
  flex: { flex: 1, minWidth: 0 },
  availability: { marginBottom: 2 },
  planButton: { alignSelf: 'stretch' },
  ctaButton: { width: '100%' },
});
