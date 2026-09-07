import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Avatar, Button, Card, Icon, Loading, Photo, Pill, Rating, RowCard, Screen,
  SectionHead, Text, TopBar,
} from '@/components';
import { useNearbyPlaces, usePlaceDetail, useReviews, useToggleSaved } from '@/api/hooks/details';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 13 — məkan detalı. */
export function PlaceDetailScreen({ route, navigation }: AppScreenProps<'PlaceDetail'>) {
  const { slug } = route.params;
  const place = usePlaceDetail(slug);
  const nearby = useNearbyPlaces(slug);
  const reviews = useReviews('place', slug);
  const save = useToggleSaved();

  if (place.isLoading) return <Loading label="Məkan yüklənir…" />;
  if (!place.data) return null;
  const p = place.data;

  return (
    <Screen
      padded={false}
      edges={[]}
      footer={
        <Button
          label="Plana əlavə et"
          left={<Icon name="plus" size={18} color="#fff" />}
          onPress={() => navigation.navigate('AddToPlan', { type: 'place', slug, name: p.name })}
          style={styles.ctaButton}
        />
      }
    >
      <View style={styles.hero}>
        <Photo uri={p.photos[0]?.url} style={styles.heroImage} radius={0} />
        <View style={styles.heroShade} />
        <View style={styles.heroBar}>
          <TopBar
            light
            transparent
            onBack={navigation.goBack}
            actions={[
              { icon: 'bookmark', onPress: () => save.mutate({ type: 'place', target: slug, saved: false }) },
              { icon: 'share' },
            ]}
          />
        </View>
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
      </View>

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
          {p.altitudeM ? <Fact icon="mountain" value={`${p.altitudeM} m`} label="Hündürlük" /> : null}
          {p.visitDurationH ? <Fact icon="clock" value={`${p.visitDurationH} saat`} label="Ziyarət" /> : null}
          <Fact
            icon="coins"
            value={p.entranceFeeAzn ? `${p.entranceFeeAzn} AZN` : 'Pulsuz'}
            label="Giriş"
          />
        </View>

        {p.description ? (
          <Text variant="body" color="ink2" style={styles.description}>
            {p.description}
          </Text>
        ) : null}

        {p.photos.length > 1 ? (
          <View style={styles.section}>
            <SectionHead title={`Fotolar (${p.photoCount})`} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
              {p.photos.map((photo, i) => (
                <Photo key={i} uri={photo.url} style={styles.galleryPhoto} radius={t.radius.md} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {reviews.data?.data.length ? (
          <View style={styles.section}>
            <SectionHead title={`Rəylər (${p.reviewCount})`} />
            <View style={styles.list}>
              {reviews.data.data.slice(0, 3).map((r) => (
                <Card key={r.publicId} padded style={styles.review}>
                  <View style={styles.reviewHead}>
                    <Avatar uri={r.author.avatarUrl} size={36} />
                    <View style={styles.flex}>
                      <View style={styles.reviewAuthor}>
                        <Text variant="h3">{r.author.fullName}</Text>
                        {r.author.isLocalExpert ? <Pill label="Local Expert" tone="brown" /> : null}
                      </View>
                      <Text variant="caption">Level {r.author.level}</Text>
                    </View>
                    <Rating value={r.rating} />
                  </View>
                  {r.body ? (
                    <Text variant="small" color="ink2" style={styles.reviewBody}>
                      {r.body}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        {nearby.data?.length ? (
          <View style={styles.section}>
            <SectionHead title="Yaxınlıqdakılar" />
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
    </Screen>
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
  hero: { height: 320, backgroundColor: t.colors.bg2 },
  heroImage: { width: '100%', height: 320 },
  heroShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,20,20,0.34)',
  },
  heroBar: { position: 'absolute', top: 44, left: 0, right: 0 },
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
  review: { gap: t.spacing.sm },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  reviewAuthor: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  reviewBody: { lineHeight: 20 },
  flex: { flex: 1, minWidth: 0 },
  ctaButton: { width: '100%' },
});
