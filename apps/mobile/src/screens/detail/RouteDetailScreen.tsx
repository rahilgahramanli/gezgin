import { Alert, Pressable, StyleSheet, View } from 'react-native';
import {
  Avatar, Button, Card, DetailSkeleton, ErrorState, HeroScreen, Icon, Photo, Pill, Rating, SectionHead, StatCell, Text,
} from '@/components';
import { useRouteDetail, useToggleSaved } from '@/api/hooks/details';
import { useDeleteRoute } from '@/api/hooks/routeBuilder';
import { DIFFICULTY_LABEL, label } from '@/lib/labels';
import { alertError } from '@/lib/errors';
import { shareItem } from '@/lib/share';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';
import { ReviewsBlock } from './ReviewsBlock';

const HERO_HEIGHT = 280;

/** Ekran 15 — marşrut detalı, gün-gün plan. */
export function RouteDetailScreen({ route, navigation }: AppScreenProps<'RouteDetail'>) {
  const { slug } = route.params;
  const detail = useRouteDetail(slug);
  const save = useToggleSaved('route', slug);
  const remove = useDeleteRoute();

  if (!detail.data) {
    return detail.error && !detail.isFetching ? (
      <ErrorState error={detail.error} onRetry={() => void detail.refetch()} onBack={navigation.goBack} />
    ) : (
      <DetailSkeleton onBack={navigation.goBack} />
    );
  }
  const r = detail.data;

  const confirmDelete = () =>
    Alert.alert('Marşrut silinsin?', `“${r.title}” və onun dayanacaqları silinəcək. Bu geri qaytarılmır.`, [
      { text: 'İmtina', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () =>
          remove.mutate(slug, {
            onSuccess: () => navigation.goBack(),
            onError: (error) => alertError(error, 'Marşrut silinmədi'),
          }),
      },
    ]);

  return (
    <HeroScreen
      heroHeight={HERO_HEIGHT}
      title={r.title}
      onBack={navigation.goBack}
      actions={[
        {
          icon: 'bookmark',
          label: r.isSaved ? 'Saxlamanı götür' : 'Saxla',
          active: r.isSaved,
          onPress: () => save.mutate(!r.isSaved),
        },
        { icon: 'share', label: 'Paylaş', onPress: () => void shareItem('route', slug, r.title) },
      ]}
      footer={
        <Button
          label="Marşrutu başlat"
          left={<Icon name="navigation" size={18} color="#fff" />}
          // Naviqasiya ekranı (51) hələ yoxdur — marşrut səyahət planına çevrilir
          onPress={() => navigation.navigate('CreateTrip', { fromRoute: slug, title: r.title })}
          style={styles.ctaButton}
        />
      }
      hero={
        <>
          <Photo uri={r.coverUrl} style={styles.heroImage} radius={0} />
          <View style={styles.heroShade} />
          <View style={styles.heroText}>
            {r.isOfficial ? <Pill label="Rəsmi marşrut" tone="teal" /> : null}
            <Text variant="titleXl" style={styles.onPhoto}>
              {r.title}
            </Text>
            <Text variant="small" style={styles.onPhotoMeta}>
              {r.region.name} · {label(DIFFICULTY_LABEL, r.difficulty)}
            </Text>
          </View>
        </>
      }
    >
      <View style={styles.body}>
        <View style={styles.stats}>
          <StatCell value={r.distanceKm ? `${r.distanceKm} km` : '—'} label="Məsafə" />
          <StatCell value={`${r.days} gün`} label="Müddət" />
          <StatCell value={r.stopCount} label="Məkan" />
        </View>

        {/* Sahibi marşrutu yaratdıqdan sonra da redaktə edə və silə bilməlidir */}
        {r.isOwner ? (
          <Card padded style={styles.owner}>
            <View style={styles.ownerHead}>
              <Icon name="route" size={20} color={t.colors.green900} />
              <Text variant="h3" style={styles.flex}>
                Sənin marşrutun
              </Text>
              <Pill
                label={r.visibility === 'private' ? 'Şəxsi' : 'İctimai'}
                tone={r.visibility === 'private' ? 'gray' : 'teal'}
              />
            </View>
            <View style={styles.ownerActions}>
              <Button
                label="Redaktə et"
                variant="soft"
                size="sm"
                left={<Icon name="edit" size={16} color={t.colors.green900} />}
                onPress={() => navigation.navigate('RouteBuilder', { slug })}
                style={styles.flex}
              />
              <Button
                label="Marşrutu sil"
                variant="danger"
                size="sm"
                loading={remove.isPending}
                left={<Icon name="trash" size={16} color={t.colors.danger} />}
                onPress={confirmDelete}
                style={styles.flex}
              />
            </View>
          </Card>
        ) : null}

        {r.author ? (
          <Card
            padded
            style={styles.author}
            onPress={() => navigation.navigate('UserProfile', { username: r.author!.username })}
          >
            <Avatar uri={r.author.avatarUrl} size={40} name={r.author.fullName} />
            <View style={styles.flex}>
              <Text variant="h3">{r.author.fullName}</Text>
              <Text variant="caption">@{r.author.username}</Text>
            </View>
            {r.ratingCount > 0 ? <Rating value={r.rating} count={r.ratingCount} /> : null}
          </Card>
        ) : null}

        {r.description ? (
          <Text variant="body" color="ink2" style={styles.description}>
            {r.description}
          </Text>
        ) : null}

        <View>
          <SectionHead title="Günlər üzrə plan" />
          <View style={styles.days}>
            {r.itinerary.map((day) => (
              <View key={day.day} style={styles.day}>
                <View style={styles.dayHead}>
                  <Pill label={`${day.day}-ci gün`} tone="green" />
                  <Text variant="caption">
                    {day.stops.length} məkan
                  </Text>
                </View>

                {day.stops.length === 0 ? (
                  <Text variant="meta" style={styles.emptyDay}>
                    Bu günə dayanacaq əlavə edilməyib
                  </Text>
                ) : (
                  <View style={styles.timeline}>
                    {day.stops.map((stop, i) => (
                      <Pressable
                        key={stop.stopId}
                        style={styles.stop}
                        accessibilityRole="button"
                        accessibilityLabel={stop.place.name}
                        onPress={() => navigation.navigate('PlaceDetail', { slug: stop.place.slug })}
                      >
                        <View style={styles.timelineCol}>
                          <View style={styles.dot} />
                          {i < day.stops.length - 1 ? <View style={styles.line} /> : null}
                        </View>
                        <Photo uri={stop.place.coverUrl} style={styles.stopThumb} radius={10} />
                        <View style={styles.flex}>
                          <Text variant="h3" numberOfLines={1}>
                            {stop.place.name}
                          </Text>
                          <View style={styles.stopMeta}>
                            {stop.arriveTime ? (
                              <>
                                <Icon name="clock" size={13} color={t.colors.muted} />
                                <Text variant="caption">{stop.arriveTime}</Text>
                              </>
                            ) : null}
                            {stop.durationMin ? (
                              <Text variant="caption">· {stop.durationMin} dəq</Text>
                            ) : null}
                          </View>
                        </View>
                        <Icon name="chevronRight" size={18} color={t.colors.muted} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <ReviewsBlock targetType="route" target={slug} name={r.title} subtitle={r.region.name} />
      </View>
    </HeroScreen>
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
  stats: { flexDirection: 'row' },
  owner: { gap: t.spacing.md, backgroundColor: t.colors.green050, borderColor: t.colors.green100 },
  ownerHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  ownerActions: { flexDirection: 'row', gap: t.spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  description: { lineHeight: 23 },
  days: { gap: t.spacing.lg },
  day: { gap: t.spacing.md },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emptyDay: { paddingLeft: 4 },
  timeline: { gap: t.spacing.md },
  stop: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  timelineCol: { width: 12, alignItems: 'center', alignSelf: 'stretch' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.green900, marginTop: 8 },
  line: { flex: 1, width: 2, backgroundColor: t.colors.line, marginVertical: 2 },
  stopThumb: { width: 56, height: 56, backgroundColor: t.colors.bg2 },
  stopMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  flex: { flex: 1, minWidth: 0 },
  ctaButton: { width: '100%' },
});
