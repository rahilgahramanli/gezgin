import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, EmptyState, Icon, Input, Loading, Photo, Screen, Text, TopBar } from '@/components';
import { usePlaces, useSearch } from '@/api/hooks/content';
import { useAddStop } from '@/api/hooks/routeBuilder';
import { useRouteDetail } from '@/api/hooks/details';
import { ApiError } from '@/api/client';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 50 alt-ekranı — marşruta məkan seçimi (axtarış + region təklifləri). */
export function RouteAddStopScreen({ route, navigation }: AppScreenProps<'RouteAddStop'>) {
  const { slug, day } = route.params;
  const [q, setQ] = useState('');

  const detail = useRouteDetail(slug);
  const addStop = useAddStop(slug);

  // Axtarış boşdursa marşrutun öz regionundakı məkanları təklif edirik
  const search = useSearch(q, { type: 'place', limit: 20 });
  const suggestions = usePlaces({ region: detail.data?.region.slug, limit: 20 });

  const searching = q.trim().length >= 2;
  const items = searching
    ? (search.data?.results ?? []).map((h) => ({ slug: h.slug, name: h.title, meta: h.subtitle, coverUrl: h.imageUrl }))
    : (suggestions.data?.data ?? []).map((p) => ({
        slug: p.slug,
        name: p.name,
        meta: p.region.name,
        coverUrl: p.coverUrl,
      }));

  const loading = searching ? search.isLoading : suggestions.isLoading || detail.isLoading;
  const error = addStop.error instanceof ApiError ? addStop.error.message : null;

  // Artıq bu gündə olan məkanı iki dəfə əlavə etməyin mənası yoxdur
  const already = new Set(
    (detail.data?.itinerary.find((d) => d.day === day)?.stops ?? []).map((s) => s.place.slug),
  );

  const add = (placeSlug: string) =>
    addStop.mutate({ place: placeSlug, day }, { onSuccess: () => navigation.goBack() });

  return (
    <Screen padded={false}>
      <TopBar title={`${day}-ci günə əlavə et`} onBack={navigation.goBack} />

      <View style={styles.body}>
        <Input icon="search" placeholder="Məkan axtar" value={q} onChangeText={setQ} error={error} />

        {!searching && detail.data ? (
          <Text variant="small" color="ink2">
            {detail.data.region.name} regionundakı məkanlar
          </Text>
        ) : null}

        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nəticə yoxdur"
            message={searching ? 'Başqa açar söz yoxla' : 'Bu regionda hələ məkan yoxdur'}
          />
        ) : (
          items.map((item) => {
            const added = already.has(item.slug);
            return (
              <Pressable key={item.slug} onPress={() => (added ? undefined : add(item.slug))} disabled={added}>
                <Card padded style={[styles.item, added && styles.itemOff]}>
                  <Photo uri={item.coverUrl} style={styles.thumb} radius={10} />
                  <View style={styles.flex}>
                    <Text variant="h3" numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.meta ? (
                      <Text variant="caption" numberOfLines={1}>
                        {item.meta}
                      </Text>
                    ) : null}
                  </View>
                  <Icon
                    name={added ? 'check' : 'plus'}
                    size={18}
                    color={added ? t.colors.muted : t.colors.green900}
                    strokeWidth={2.4}
                  />
                </Card>
              </Pressable>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  itemOff: { opacity: 0.5 },
  thumb: { width: 48, height: 48, backgroundColor: t.colors.bg2 },
  flex: { flex: 1, minWidth: 0 },
});
