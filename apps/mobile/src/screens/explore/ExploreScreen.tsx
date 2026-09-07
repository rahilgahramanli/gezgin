import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Chip, ExperienceCard, Icon, Loading, PhotoCard, RowCard, SectionHead, Text,
} from '@/components';
import { useExperiences, usePlaces, useRegions, useRoutes } from '@/api/hooks/content';
import { useUser } from '@/store/auth';
import { t } from '@/theme';
import type { TabScreenProps } from '@/navigation/types';

/** Ekran 10 — Kəşf et. Region seçici, populyar məkanlar və seçilmiş təcrübələr. */
export function ExploreScreen({ navigation }: TabScreenProps<'Explore'>) {
  const [region, setRegion] = useState<string | undefined>();
  const user = useUser();

  const regions = useRegions();
  const places = usePlaces({ region, sort: 'popular', limit: 6 });
  const experiences = useExperiences({ region, sort: 'popular', limit: 6 });
  const routes = useRoutes({ region, sort: 'rating', limit: 4 });

  if (regions.isLoading) return <Loading label="Yüklənir…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="titleLg">
            Salam, {user?.fullName?.split(' ')[0] ?? 'gezgin'} 👋
          </Text>
          <Text variant="meta">Harada kəşf edək bu gün?</Text>
        </View>

        <Pressable style={styles.search} onPress={() => navigation.navigate('Search')}>
          <Icon name="search" size={20} color={t.colors.muted} />
          <Text variant="body" color="muted">
            Məkan, marşrut və ya təcrübə axtar…
          </Text>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip label="Hamısı" active={!region} onPress={() => setRegion(undefined)} />
          {(regions.data ?? []).map((r) => (
            <Chip
              key={r.slug}
              label={r.name}
              active={region === r.slug}
              onPress={() => setRegion(r.slug)}
            />
          ))}
        </ScrollView>

        <View style={styles.section}>
          <SectionHead
            title="Populyar məkanlar"
            actionLabel="Daha çox"
            onAction={() => navigation.navigate('Places', region ? { region } : undefined)}
          />
          {places.isLoading ? (
            <Loading />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
              {(places.data?.data ?? []).map((p) => (
                <PhotoCard
                  key={p.slug}
                  uri={p.coverUrl}
                  title={p.name}
                  subtitle={p.region.name}
                  rating={p.rating}
                  width={220}
                  height={180}
                  onPress={() => navigation.navigate('PlaceDetail', { slug: p.slug })}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <SectionHead
            title="Seçilmiş təcrübələr"
            actionLabel="Daha çox"
            onAction={() => navigation.navigate('Experiences')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
            {(experiences.data?.data ?? []).map((e) => (
              <ExperienceCard
                key={e.slug}
                uri={e.coverUrl}
                title={e.title}
                subtitle={e.region.name}
                priceAzn={e.priceAzn}
                rating={e.rating || undefined}
                ratingCount={e.ratingCount || undefined}
                width={210}
                onPress={() => navigation.navigate('ExperienceDetail', { slug: e.slug })}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHead
            title="Tövsiyə olunan marşrutlar"
            actionLabel="Daha çox"
            onAction={() => navigation.navigate('Routes')}
          />
          <View style={styles.list}>
            {(routes.data?.data ?? []).map((r) => (
              <RowCard
                key={r.slug}
                uri={r.coverUrl}
                title={r.title}
                subtitle={`${r.days} gün · ${r.region.name}`}
                meta={
                  <Text variant="small" color="muted">
                    {r.stopCount} dayanacaq{r.distanceKm ? ` · ${r.distanceKm} km` : ''}
                  </Text>
                }
                onPress={() => navigation.navigate('RouteDetail', { slug: r.slug })}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.colors.bg },
  content: { paddingBottom: t.spacing.xxl },
  header: { paddingHorizontal: t.spacing.page, gap: 2, marginBottom: t.spacing.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    height: 50,
    marginHorizontal: t.spacing.page,
    paddingHorizontal: t.spacing.lg,
    backgroundColor: t.colors.paper,
    borderWidth: 1,
    borderColor: t.colors.line,
    borderRadius: t.radius.pill,
  },
  chips: { gap: t.spacing.sm, paddingHorizontal: t.spacing.page, paddingVertical: t.spacing.lg },
  section: { marginTop: t.spacing.lg, paddingHorizontal: t.spacing.page },
  hscroll: { gap: t.spacing.md, paddingRight: t.spacing.page },
  list: { gap: t.spacing.md },
});
