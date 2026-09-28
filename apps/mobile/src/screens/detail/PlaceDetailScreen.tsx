import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button, DetailSkeleton, ErrorState, HeroScreen, Icon, Photo, Pill, Rating, RowCard, SectionHead, Text,
} from '@/components';
import { useNearbyPlaces, usePlaceDetail, useToggleSaved } from '@/api/hooks/details';
import { shareItem } from '@/lib/share';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';
import { ReviewsBlock } from './ReviewsBlock';

const HERO_HEIGHT = 320;

/** Ekran 13 — məkan detalı. */
export function PlaceDetailScreen({ route, navigation }: AppScreenProps<'PlaceDetail'>) {
  const { t: tr, tp: tpr } = useT('explore');
  const { slug } = route.params;
  const place = usePlaceDetail(slug);
  const nearby = useNearbyPlaces(slug);
  const save = useToggleSaved('place', slug);

  if (!place.data) {
    // Xəta halında ağ ekran yox — səbəb, "Yenidən cəhd et" və geri; təkrar cəhd zamanı skelet
    return place.error && !place.isFetching ? (
      <ErrorState error={place.error} onRetry={() => void place.refetch()} onBack={navigation.goBack} />
    ) : (
      <DetailSkeleton onBack={navigation.goBack} />
    );
  }
  const p = place.data;

  return (
    <HeroScreen
      heroHeight={HERO_HEIGHT}
      title={p.name}
      onBack={navigation.goBack}
      actions={[
        {
          icon: 'bookmark',
          label: p.isSaved ? tr('unsave') : tr('common:actions.saveItem'),
          active: p.isSaved,
          onPress: () => save.mutate(!p.isSaved),
        },
        { icon: 'share', label: tr('common:actions.share'), onPress: () => void shareItem('place', slug, p.name) },
      ]}
      footer={
        <View style={styles.footerRow}>
          {/* Check-in əvvəllər yalnız səyahət planındakı elementdən açılırdı */}
          <Button
            label={tr('place.checkin')}
            variant="outline"
            left={<Icon name="pin" size={18} color={t.colors.green900} />}
            onPress={() => navigation.navigate('Checkin', { place: slug })}
            style={styles.checkinButton}
          />
          <Button
            label={tr('addToTrip')}
            onPress={() => navigation.navigate('AddToPlan', { type: 'place', slug, name: p.name })}
            style={styles.planButton}
          />
        </View>
      }
      hero={
        <>
          <Photo uri={p.photos[0]?.url} style={styles.heroImage} radius={0} />
          <View style={styles.heroShade} />
          <View style={styles.heroText}>
            <Text variant="titleXl" style={styles.onPhoto}>
              {p.name}
            </Text>
            <View style={styles.heroMeta}>
              <Icon name="pin" size={15} color="rgba(255,255,255,0.9)" />
              <Text variant="small" style={styles.onPhotoMeta}>
                {p.region.name}
                {p.altitudeM ? ` · ${p.altitudeM} m` : ''}
              </Text>
            </View>
          </View>
        </>
      }
    >
      <View style={styles.body}>
        <View style={styles.ratingRow}>
          <Rating value={p.rating} count={p.ratingCount} size={18} />
          <View style={styles.chips}>
            {p.categories.slice(0, 3).map((c) => (
              <Pill key={c.slug} label={c.name} tone="green" />
            ))}
          </View>
        </View>

        {/* Faktlar — ekran 13-dəki üç xana */}
        <View style={styles.facts}>
          {p.altitudeM ? <Fact icon="mountain" value={`${p.altitudeM} m`} label={tr('place.altitude')} /> : null}
          {p.visitDurationH ? (
            <Fact
              icon="clock"
              value={tpr('common:labels.duration.hours', p.visitDurationH)}
              label={tr('place.visit')}
            />
          ) : null}
          <Fact
            icon="coins"
            value={p.entranceFeeAzn ? `${p.entranceFeeAzn} AZN` : tr('free')}
            label={tr('place.entry')}
          />
        </View>

        {p.description ? (
          <Text variant="body" color="ink2" style={styles.description}>
            {p.description}
          </Text>
        ) : null}

        {/* Bir foto olsa da qalereyaya (ekran 46) keçid lazımdır — icma fotoları orada */}
        {p.photos.length > 0 ? (
          <View style={styles.section}>
            <SectionHead
              title={tr('place.photos', { total: p.photoCount })}
              actionLabel={tr('all')}
              onAction={() => navigation.navigate('PhotoGallery', { slug, name: p.name })}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
              {p.photos.map((photo, i) => (
                <Photo key={i} uri={photo.url} style={styles.galleryPhoto} radius={t.radius.md} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <ReviewsBlock targetType="place" target={slug} name={p.name} subtitle={p.region.name} />

        {nearby.data?.length ? (
          <View style={styles.section}>
            <SectionHead title={tr('place.nearby')} />
            <View style={styles.list}>
              {nearby.data.map((n) => (
                <RowCard
                  key={n.slug}
                  uri={n.coverUrl}
                  title={n.name}
                  subtitle={n.distanceKm != null ? `${n.distanceKm} km` : undefined}
                  meta={<Rating value={n.rating} />}
                  onPress={() => navigation.push('PlaceDetail', { slug: n.slug })}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </HeroScreen>
  );
}

function Fact({ icon, value, label }: { icon: 'mountain' | 'clock' | 'coins'; value: string; label: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={20} color={t.colors.green900} />
      <Text variant="h3" style={styles.factValue}>
        {value}
      </Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroImage: { width: '100%', height: HERO_HEIGHT },
  heroShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,20,20,0.34)',
  },
  heroText: { position: 'absolute', left: t.spacing.page, right: t.spacing.page, bottom: t.spacing.xl, gap: 4 },
  onPhoto: { color: '#fff' },
  onPhotoMeta: { color: 'rgba(255,255,255,0.92)' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  body: { paddingHorizontal: t.spacing.page, paddingTop: t.spacing.lg, gap: t.spacing.lg },
  ratingRow: { gap: t.spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  facts: { flexDirection: 'row', gap: t.spacing.md },
  fact: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    padding: t.spacing.md,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.paper,
  },
  factValue: { marginTop: 2 },
  description: { lineHeight: 23 },
  section: { gap: 0 },
  hscroll: { gap: t.spacing.md, paddingRight: t.spacing.page },
  galleryPhoto: { width: 150, height: 110, backgroundColor: t.colors.bg2 },
  list: { gap: t.spacing.md },
  footerRow: { flexDirection: 'row', gap: t.spacing.md },
  checkinButton: { paddingHorizontal: 16 },
  planButton: { flex: 1, paddingHorizontal: 12 },
});
