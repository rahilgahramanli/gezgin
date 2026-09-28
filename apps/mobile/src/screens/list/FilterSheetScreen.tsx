import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Icon, Rating, Screen, Text, TopBar } from '@/components';
import { usePlaceFilters } from '@/api/hooks/details';
import { usePlaces } from '@/api/hooks/content';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';
import { kmLabel } from '@/lib/labels';

export interface PlaceFilterValue {
  categories: string[];
  minRating?: number;
  priceLevel?: number;
  maxDistanceKm?: number;
}

const DISTANCES = [5, 10, 25, 50, 100];

/** Panel seçimləri → `/places` sorğu parametrləri (DTO adları ilə eyni). */
export function toQuery(value: PlaceFilterValue): Record<string, unknown> {
  return {
    ...(value.categories.length ? { categories: value.categories.join(',') } : {}),
    ...(value.minRating ? { minRating: value.minRating } : {}),
    ...(value.priceLevel !== undefined ? { priceLevel: value.priceLevel } : {}),
    ...(value.maxDistanceKm ? { radiusKm: value.maxDistanceKm } : {}),
  };
}

/** Ekran 45 — filtr paneli. Nəticə sayı seçimlə birlikdə yenilənir. */
export function FilterSheetScreen({ route, navigation }: AppScreenProps<'FilterSheet'>) {
  const { t: tr, tp: tpr } = useT('explore');
  const { region, value } = route.params;
  const filters = usePlaceFilters(region);
  const [draft, setDraft] = useState<PlaceFilterValue>(value ?? { categories: [] });

  // Nəticə sayı seçimlə birlikdə yenilənir — "Göstər" düyməsi boş siyahıya aparmasın.
  // API cəmi sayı qaytarmır, ona görə bir səhifə oxunur və qalıq "+" ilə göstərilir.
  const preview = usePlaces({ region, limit: 50, ...toQuery(draft) });
  const count = preview.data?.data.length ?? 0;
  const countLabel = preview.data?.nextOffset ? `${count}+` : `${count}`;

  const toggleCategory = (slug: string) =>
    setDraft((d) => ({
      ...d,
      categories: d.categories.includes(slug) ? d.categories.filter((c) => c !== slug) : [...d.categories, slug],
    }));

  const activeCount =
    draft.categories.length + (draft.minRating ? 1 : 0) + (draft.priceLevel !== undefined ? 1 : 0) + (draft.maxDistanceKm ? 1 : 0);

  return (
    <Screen
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button
            label={tr('filter.reset')}
            variant="soft"
            onPress={() => setDraft({ categories: [] })}
            style={styles.reset}
          />
          <Button
            label={
              preview.isLoading
                ? tr('filter.show')
                : tpr('filter.showPlaces', count, { replace: { shown: countLabel } })
            }
            style={styles.apply}
            // popTo: mövcud Yerlər ekranına qayıdır — navigate isə hər dəfə yenisini üst-üstə qoyurdu
            onPress={() => navigation.popTo('Places', { region, filter: draft }, { merge: true })}
          />
        </View>
      }
    >
      <TopBar
        title={tr('filter.title')}
        onBack={navigation.goBack}
        right={
          activeCount ? (
            <Text variant="small" color="green700">
              {tpr('filter.active', activeCount)}
            </Text>
          ) : undefined
        }
      />

      <View style={styles.body}>
        <Text variant="h2">{tr('filter.category')}</Text>
        <View style={styles.chips}>
          {(filters.data?.categories ?? []).map((c) => (
            <Chip
              key={c.slug}
              label={c.name}
              active={draft.categories.includes(c.slug)}
              onPress={() => toggleCategory(c.slug)}
            />
          ))}
        </View>

        <Text variant="h2">{tr('filter.minRating')}</Text>
        <View style={styles.chips}>
          {(filters.data?.ratings ?? []).map((r) => (
            <Chip
              key={r}
              label={r === 0 ? tr('all') : `${r.toFixed(1)}+`}
              active={(draft.minRating ?? 0) === r}
              onPress={() => setDraft((d) => ({ ...d, minRating: r === 0 ? undefined : r }))}
            />
          ))}
        </View>
        {draft.minRating ? (
          <View style={styles.ratingHint}>
            <Rating value={draft.minRating} size={14} />
            <Text variant="meta" color="muted">
              {tr('filter.andUp')}
            </Text>
          </View>
        ) : null}

        <Text variant="h2">{tr('filter.entranceFee')}</Text>
        <View style={styles.chips}>
          {(filters.data?.priceLevels ?? []).map((p) => (
            <Chip
              key={p.level}
              label={p.label}
              tone="brown"
              active={draft.priceLevel === p.level}
              onPress={() =>
                setDraft((d) => ({ ...d, priceLevel: d.priceLevel === p.level ? undefined : p.level }))
              }
            />
          ))}
        </View>

        <Text variant="h2">{tr('filter.distance')}</Text>
        <View style={styles.chips}>
          {DISTANCES.map((km) => (
            <Chip
              key={km}
              label={kmLabel(km)}
              active={draft.maxDistanceKm === km}
              onPress={() => setDraft((d) => ({ ...d, maxDistanceKm: d.maxDistanceKm === km ? undefined : km }))}
            />
          ))}
        </View>
        <View style={styles.note}>
          <Icon name="info" size={16} color={t.colors.muted} />
          <Text variant="meta" color="muted">
            {tr('filter.distanceNote')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: t.spacing.page, gap: t.spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginBottom: t.spacing.sm },
  ratingHint: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginTop: -t.spacing.sm },
  note: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginTop: t.spacing.sm },
  footer: { flexDirection: 'row', gap: t.spacing.md },
  reset: { flex: 1 },
  apply: { flex: 2 },
});
