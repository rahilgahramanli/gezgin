import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, EmptyState, ListSkeleton, Rating, RowCard, Screen, Text, TopBar } from '@/components';
import { usePlaces, useRegions } from '@/api/hooks/content';
import { toQuery, type PlaceFilterValue } from '@/screens/list/FilterSheetScreen';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 12 — yerlər siyahısı və filtrlər. */
export function PlacesScreen({ route, navigation }: AppScreenProps<'Places'>) {
  const [region, setRegion] = useState<string | undefined>(route.params?.region);
  const [sort, setSort] = useState<'popular' | 'rating'>('popular');
  // Filtr paneli (ekran 45) nəticəni `route.params` ilə geri qaytarır
  const filter: PlaceFilterValue = route.params?.filter ?? { categories: [] };
  const activeFilters =
    filter.categories.length +
    (filter.minRating ? 1 : 0) +
    (filter.priceLevel !== undefined ? 1 : 0) +
    (filter.maxDistanceKm ? 1 : 0);

  const regions = useRegions();
  const places = usePlaces({ region, sort, limit: 30, ...toQuery(filter) });

  return (
    <Screen padded={false}>
      <TopBar
        title="Yerlər"
        onBack={navigation.goBack}
        actions={[
          { icon: 'map', label: 'Xəritədə göstər', onPress: () => navigation.navigate('Map', region ? { region } : undefined) },
          {
            icon: 'filter',
            label: activeFilters ? `Filtr (${activeFilters} aktiv)` : 'Filtr',
            active: activeFilters > 0,
            onPress: () => navigation.navigate('FilterSheet', { region, value: filter }),
          },
        ]}
      />

      <View style={styles.filters}>
        <View style={styles.chipRow}>
          <Chip label="Hamısı" active={!region} onPress={() => setRegion(undefined)} />
          {(regions.data ?? []).map((r) => (
            <Chip key={r.slug} label={r.name} active={region === r.slug} onPress={() => setRegion(r.slug)} />
          ))}
        </View>
        <View style={styles.chipRow}>
          <Chip label="Populyar" active={sort === 'popular'} onPress={() => setSort('popular')} />
          <Chip label="Ən yüksək reytinq" active={sort === 'rating'} onPress={() => setSort('rating')} />
        </View>
      </View>

      <View style={styles.body}>
        {places.isLoading ? (
          <ListSkeleton />
        ) : !places.data?.data.length ? (
          <EmptyState title="Məkan tapılmadı" message="Filtri dəyişib yenidən cəhd edin." />
        ) : (
          <>
            <Text variant="meta" style={styles.count}>
              {places.data.data.length} məkan
            </Text>
            <View style={styles.list}>
              {places.data.data.map((p) => (
                <RowCard
                  key={p.slug}
                  uri={p.coverUrl}
                  title={p.name}
                  subtitle={p.region.name}
                  meta={
                    <View style={styles.meta}>
                      <Rating value={p.rating} count={p.ratingCount} />
                      {p.distanceKm != null ? (
                        <Text variant="caption">{p.distanceKm} km</Text>
                      ) : null}
                      {p.entranceFeeAzn === 0 ? <Text variant="caption">Pulsuz</Text> : null}
                    </View>
                  }
                  onPress={() => navigation.navigate('PlaceDetail', { slug: p.slug })}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: t.spacing.page, gap: t.spacing.sm, paddingBottom: t.spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  body: { paddingHorizontal: t.spacing.page },
  count: { marginBottom: t.spacing.md },
  list: { gap: t.spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
});
