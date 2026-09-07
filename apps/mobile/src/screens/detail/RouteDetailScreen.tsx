import { StyleSheet, View } from 'react-native';
import {
  Avatar, Button, Card, Icon, Loading, Photo, Pill, Rating, Screen, SectionHead, StatCell, Text, TopBar,
} from '@/components';
import { useRouteDetail } from '@/api/hooks/details';
import { DIFFICULTY_LABEL, label } from '@/lib/labels';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 15 — marşrut detalı, gün-gün plan. */
export function RouteDetailScreen({ route, navigation }: AppScreenProps<'RouteDetail'>) {
  const { slug } = route.params;
  const detail = useRouteDetail(slug);

  if (detail.isLoading) return <Loading label="Marşrut yüklənir…" />;
  if (!detail.data) return null;
  const r = detail.data;

  return (
    <Screen padded={false} edges={[]}
      footer={
        <Button
          label="Marşrutu başlat"
          left={<Icon name="navigation" size={18} color="#fff" />}
          // Naviqasiya ekranı (51) hələ yoxdur — marşrut səyahət planına çevrilir
          onPress={() => navigation.navigate('CreateTrip', { fromRoute: slug, title: r.title })}
          style={styles.ctaButton}
        />
      }
    >
      <View style={styles.hero}>
        <Photo uri={r.coverUrl} style={styles.heroImage} radius={0} />
        <View style={styles.heroShade} />
        <View style={styles.heroBar}>
          <TopBar light transparent onBack={navigation.goBack} actions={[{ icon: 'share' }]} />
        </View>
        <View style={styles.heroText}>
          {r.isOfficial ? <Pill label="Rəsmi marşrut" tone="teal" /> : null}
          <Text variant="titleXl" style={styles.onPhoto}>
            {r.title}
          </Text>
          <Text variant="small" style={styles.onPhotoMeta}>
            {r.region.name} · {label(DIFFICULTY_LABEL, r.difficulty)}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.stats}>
          <StatCell value={r.distanceKm ? `${r.distanceKm} km` : '—'} label="Məsafə" />
          <StatCell value={`${r.days} gün`} label="Müddət" />
          <StatCell value={r.stopCount} label="Məkan" />
        </View>

        {r.author ? (
          <Card padded style={styles.author}>
            <Avatar uri={r.author.avatarUrl} size={40} />
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
                      <View key={stop.stopId} style={styles.stop}>
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
                        <Icon
                          name="chevronRight"
                          size={18}
                          color={t.colors.muted}
                          onPress={() => navigation.navigate('PlaceDetail', { slug: stop.place.slug })}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 280, backgroundColor: t.colors.bg2 },
  heroImage: { width: '100%', height: 280 },
  heroShade: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,20,20,0.36)',
  },
  heroBar: { position: 'absolute', top: 44, left: 0, right: 0 },
  heroText: { position: 'absolute', left: t.spacing.page, right: t.spacing.page, bottom: t.spacing.xl, gap: 6 },
  onPhoto: { color: '#fff' },
  onPhotoMeta: { color: 'rgba(255,255,255,0.92)' },
  body: { paddingHorizontal: t.spacing.page, paddingTop: t.spacing.lg, gap: t.spacing.lg },
  stats: { flexDirection: 'row' },
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
