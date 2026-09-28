import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, EmptyState, ListSkeleton, Pill, Rating, RowCard, Screen, Text, TopBar } from '@/components';
import { useRoutes } from '@/api/hooks/content';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 14 — marşrutlar, müddət filtri ilə. Çip mətni render zamanı tərcümə olunur. */
const DURATIONS = [
  { key: undefined, labelKey: 'all' },
  { key: '1', labelKey: 'routes.durations.day1' },
  { key: '2-3', labelKey: 'routes.durations.days2to3' },
  { key: '4', labelKey: 'routes.durations.days4plus' },
] as const;

export function RoutesScreen({ navigation }: AppScreenProps<'Routes'>) {
  const { t: tr, tp: tpr } = useT('explore');
  const [duration, setDuration] = useState<string | undefined>();
  const routes = useRoutes({ duration, limit: 30 });

  return (
    <Screen padded={false}>
      <TopBar
        title={tr('routes.title')}
        onBack={navigation.goBack}
        actions={[{ icon: 'plus', onPress: () => navigation.navigate('RouteBuilder') }]}
      />

      <View style={styles.chipRow}>
        {DURATIONS.map((d) => (
          <Chip key={d.labelKey} label={tr(d.labelKey)} active={duration === d.key} onPress={() => setDuration(d.key)} />
        ))}
      </View>

      <View style={styles.body}>
        {routes.isLoading ? (
          <ListSkeleton />
        ) : !routes.data?.data.length ? (
          <EmptyState
            title={tr('routes.emptyTitle')}
            message={tr('routes.emptyMessage')}
            action={
              <Button
                label={tr('routes.build')}
                variant="soft"
                size="sm"
                onPress={() => navigation.navigate('RouteBuilder')}
              />
            }
          />
        ) : (
          <View style={styles.list}>
            {routes.data.data.map((r) => (
              <RowCard
                key={r.slug}
                uri={r.coverUrl}
                title={r.title}
                subtitle={`${tpr('common:labels.duration.days', r.days)} · ${r.region.name}`}
                meta={
                  <View style={styles.meta}>
                    {r.ratingCount > 0 ? <Rating value={r.rating} count={r.ratingCount} /> : null}
                    <Text variant="caption">{tpr('units.stops', r.stopCount)}</Text>
                    {r.distanceKm ? <Text variant="caption">{r.distanceKm} km</Text> : null}
                    {r.isOfficial ? <Pill label={tr('routes.official')} tone="teal" /> : null}
                  </View>
                }
                onPress={() => navigation.navigate('RouteDetail', { slug: r.slug })}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm,
    paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.lg,
  },
  body: { paddingHorizontal: t.spacing.page },
  list: { gap: t.spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' },
});
