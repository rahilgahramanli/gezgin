import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type Region as MapRegion } from 'react-native-maps';
import { Card, Chip, Icon, Photo, Rating, Screen, Text, TopBar } from '@/components';
import { usePlacesMap, useRegions } from '@/api/hooks/content';
import { usePlaceDetail } from '@/api/hooks/details';
import { getCurrentPosition } from '@/lib/location';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Azərbaycanın mərkəzi — xəritə burdan açılır. */
const INITIAL: MapRegion = {
  latitude: 40.3,
  longitude: 47.9,
  latitudeDelta: 4.2,
  longitudeDelta: 4.2,
};

/**
 * `longitudeDelta` → tayl zoom səviyyəsi.
 * Server zoom 13-dən aşağıda klaster, yuxarıda fərdi pin qaytarır.
 */
const zoomOf = (r: MapRegion): number =>
  Math.max(1, Math.min(20, Math.round(Math.log2(360 / Math.max(r.longitudeDelta, 0.0001)))));

const bboxOf = (r: MapRegion): string =>
  [
    r.longitude - r.longitudeDelta / 2,
    r.latitude - r.latitudeDelta / 2,
    r.longitude + r.longitudeDelta / 2,
    r.latitude + r.latitudeDelta / 2,
  ]
    .map((n) => n.toFixed(4))
    .join(',');

/** Ekran 12 xəritə rejimi — pinlər, klasterlər və seçilən məkan kartı. */
export function MapScreen({ route, navigation }: AppScreenProps<'Map'>) {
  const mapRef = useRef<MapView>(null);
  const [viewport, setViewport] = useState<MapRegion>(INITIAL);
  const [region, setRegion] = useState<string | undefined>(route.params?.region);
  const [selected, setSelected] = useState<string | null>(null);

  const regions = useRegions();
  const zoom = zoomOf(viewport);

  // Region çipi seçiləndə bbox-u yox, region filtrini göndəririk —
  // istifadəçi xəritəni sürüşdürməmiş də nəticə görsün
  const map = usePlacesMap(region ? { region, zoom } : { bbox: bboxOf(viewport), zoom });

  const points = map.data?.mode === 'points' ? map.data.items : [];
  const clusters = map.data?.mode === 'clusters' ? map.data.items : [];

  const goToRegion = (slug?: string) => {
    setRegion(slug);
    setSelected(null);
    const r = regions.data?.find((x) => x.slug === slug);
    if (r?.lat != null && r.lng != null) {
      mapRef.current?.animateToRegion(
        { latitude: r.lat, longitude: r.lng, latitudeDelta: 0.6, longitudeDelta: 0.6 },
        400,
      );
    } else if (!slug) {
      mapRef.current?.animateToRegion(INITIAL, 400);
    }
  };

  const locate = async () => {
    const coords = await getCurrentPosition();
    if (!coords) return;
    mapRef.current?.animateToRegion(
      { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.25, longitudeDelta: 0.25 },
      500,
    );
  };

  return (
    <Screen padded={false} scroll={false} edges={['top']}>
      <TopBar
        title="Xəritə"
        onBack={navigation.goBack}
        actions={[{ icon: 'search', onPress: () => navigation.navigate('Search') }]}
      />

      <View style={styles.chipRow}>
        <Chip label="Hamısı" active={!region} onPress={() => goToRegion(undefined)} />
        {(regions.data ?? []).map((r) => (
          <Chip key={r.slug} label={r.name} active={region === r.slug} onPress={() => goToRegion(r.slug)} />
        ))}
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={INITIAL}
          onRegionChangeComplete={setViewport}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          {points.map((p) => (
            <Marker
              key={p.slug}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              onPress={() => setSelected(p.slug)}
              tracksViewChanges={false}
            >
              <View style={[styles.pin, selected === p.slug && styles.pinActive]}>
                <Icon name="pinDot" size={13} color="#fff" />
              </View>
            </Marker>
          ))}

          {clusters.map((c) => (
            <Marker
              key={`${c.lat},${c.lng}`}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              tracksViewChanges={false}
              onPress={() =>
                mapRef.current?.animateToRegion(
                  { latitude: c.lat, longitude: c.lng, latitudeDelta: 0.3, longitudeDelta: 0.3 },
                  400,
                )
              }
            >
              <View style={styles.cluster}>
                <Text variant="caption" color="paper" style={styles.clusterText}>
                  {c.count}
                </Text>
              </View>
            </Marker>
          ))}
        </MapView>

        <Pressable onPress={locate} style={styles.locateBtn}>
          <Icon name="navigation" size={18} color={t.colors.green900} />
        </Pressable>

        {map.isFetching ? (
          <View style={styles.badge}>
            <Text variant="caption" color="paper">
              Yüklənir…
            </Text>
          </View>
        ) : (
          <View style={styles.badge}>
            <Text variant="caption" color="paper">
              {map.data?.mode === 'clusters'
                ? `${clusters.reduce((n, c) => n + c.count, 0)} məkan · yaxınlaş`
                : `${points.length} məkan`}
            </Text>
          </View>
        )}

        {selected ? (
          <SelectedCard
            slug={selected}
            onClose={() => setSelected(null)}
            onOpen={() => navigation.navigate('PlaceDetail', { slug: selected })}
          />
        ) : null}
      </View>
    </Screen>
  );
}

/** Pin seçiləndə aşağıda açılan kart — ekran 12-dəki məkan sətri ilə eyni. */
function SelectedCard({ slug, onClose, onOpen }: { slug: string; onClose: () => void; onOpen: () => void }) {
  const place = usePlaceDetail(slug);
  const p = place.data;

  return (
    <View style={styles.sheet}>
      <Card padded onPress={onOpen} style={styles.sheetCard}>
        <Photo uri={p?.photos[0]?.url ?? null} style={styles.sheetPhoto} radius={10} />
        <View style={styles.flex}>
          <Text variant="h3" numberOfLines={1}>
            {p?.name ?? 'Yüklənir…'}
          </Text>
          {p ? (
            <Text variant="caption" numberOfLines={1}>
              {p.region.name}
            </Text>
          ) : null}
          {p && p.ratingCount > 0 ? <Rating value={p.rating} count={p.ratingCount} /> : null}
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose}>
          <Icon name="x" size={16} color={t.colors.muted} />
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm,
    paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.md,
  },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  pin: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: t.colors.green900,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  pinActive: { backgroundColor: t.colors.brown700, transform: [{ scale: 1.18 }] },
  cluster: {
    minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 6,
    backgroundColor: t.colors.green900, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  clusterText: { fontWeight: '700' },
  locateBtn: {
    position: 'absolute', right: t.spacing.page, top: t.spacing.md,
    width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.paper,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: t.colors.line,
  },
  badge: {
    position: 'absolute', left: t.spacing.page, top: t.spacing.md,
    backgroundColor: 'rgba(15,61,58,0.85)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: t.radius.pill,
  },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: t.spacing.page },
  sheetCard: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  sheetPhoto: { width: 52, height: 52, backgroundColor: t.colors.bg2 },
  sheetClose: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
