import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, EmptyState, Loading, Pill, Rating, RowCard, Screen, Text, TopBar } from '@/components';
import { useRoutes } from '@/api/hooks/content';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 14 — marşrutlar, müddət filtri ilə. */
const DURATIONS = [
  { key: undefined, label: 'Hamısı' },
  { key: '1', label: '1 gün' },
  { key: '2-3', label: '2–3 gün' },
  { key: '4', label: '4+ gün' },
] as const;

export function RoutesScreen({ navigation }: AppScreenProps<'Routes'>) {
  const [duration, setDuration] = useState<string | undefined>();
  const routes = useRoutes({ duration, limit: 30 });

  return (
    <Screen padded={false}>
      <TopBar
        title="Marşrutlar"
        onBack={navigation.goBack}
        actions={[{ icon: 'plus', onPress: () => navigation.navigate('RouteBuilder') }]}
      />

      <View style={styles.chipRow}>
        {DURATIONS.map((d) => (
          <Chip key={d.label} label={d.label} active={duration === d.key} onPress={() => setDuration(d.key)} />
        ))}
      </View>

      <View style={styles.body}>
        {routes.isLoading ? (
          <Loading />
        ) : !routes.data?.data.length ? (
          <EmptyState
            title="Marşrut tapılmadı"
            message="Başqa müddət seçin və ya özün marşrut qur."
            action={
              <Button
                label="Marşrut qur"
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
                subtitle={`${r.days} gün · ${r.region.name}`}
                meta={
                  <View style={styles.meta}>
                    {r.ratingCount > 0 ? <Rating value={r.rating} count={r.ratingCount} /> : null}
                    <Text variant="caption">{r.stopCount} dayanacaq</Text>
                    {r.distanceKm ? <Text variant="caption">{r.distanceKm} km</Text> : null}
                    {r.isOfficial ? <Pill label="Rəsmi" tone="teal" /> : null}
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
