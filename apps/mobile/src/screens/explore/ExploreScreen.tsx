import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button, Card, Chip, ExperienceCard, Icon, Loading, PhotoCard, RowCard, SectionHead, Text,
} from '@/components';
import { errorText } from '@/lib/errors';
import { useT } from '@/i18n';
import { useExperiences, usePlaces, useRegions, useRoutes } from '@/api/hooks/content';
import { useBusinesses } from '@/api/hooks/business';
import { BUSINESS_TYPE_LABEL, label, kmLabel } from '@/lib/labels';
import { useUser } from '@/store/auth';
import { t } from '@/theme';
import type { TabScreenProps } from '@/navigation/types';

/** Yerləşmə təklif etməyən biznes növləri "Otellər və qonaq evləri" bölməsinə düşmür. */
const NOT_LODGING = new Set(['restoran', 'tur_sirketi']);

/** Seçilmiş regionda bölmə boşdursa yalnız başlıq qalmasın — qısa izah göstərilir. */
function EmptyLine({ children }: { children: string }) {
  return (
    <Text variant="meta" color="muted" style={styles.emptyLine}>
      {children}
    </Text>
  );
}

/** Ekran 10 — Kəşf et. Region seçici, populyar məkanlar və seçilmiş təcrübələr. */
export function ExploreScreen({ navigation }: TabScreenProps<'Explore'>) {
  const { t: tr, tp: tpr } = useT('explore');
  const [region, setRegion] = useState<string | undefined>();
  const user = useUser();

  const regions = useRegions();
  const places = usePlaces({ region, sort: 'popular', limit: 6 });
  const experiences = useExperiences({ region, sort: 'popular', limit: 6 });
  const routes = useRoutes({ region, sort: 'rating', limit: 4 });
  const businesses = useBusinesses({ region });
  const lodging = (businesses.data?.data ?? []).filter((b) => !NOT_LODGING.has(b.type));
  const regionName = regions.data?.find((r) => r.slug === region)?.name;
  // "X regionunda məkan yoxdur" / "Hələ məkan yoxdur" — hər dildə tam cümlə
  const emptyText = (kind: 'Places' | 'Experiences' | 'Routes') =>
    regionName ? tr(`home.no${kind}InRegion`, { region: regionName }) : tr(`home.no${kind}`);

  if (regions.isLoading) return <Loading label={tr('common:states.loading')} />;

  // Oflayn və ya server xətası — bölmələr səssizcə boş qalmasın
  const failed = [regions, places, experiences, routes].find((q) => q.isError);
  const refetchAll = () => {
    void regions.refetch();
    void places.refetch();
    void experiences.refetch();
    void routes.refetch();
    void businesses.refetch();
  };
  const refreshing = [places, experiences, routes].some((q) => q.isRefetching);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={t.colors.green900} />}
      >
        <View style={styles.header}>
          <Text variant="titleLg">
            {tr('home.greeting', { name: user?.fullName?.split(' ')[0] ?? tr('home.greetingFallback') })}
          </Text>
          <Text variant="meta">{tr('home.subtitle')}</Text>
        </View>

        <Pressable style={styles.search} onPress={() => navigation.navigate('Search')}>
          <Icon name="search" size={20} color={t.colors.muted} />
          <Text variant="body" color="muted">
            {tr('home.searchPlaceholder')}
          </Text>
        </Pressable>

        {failed ? (
          <Card padded style={styles.errorCard}>
            <Text variant="h3">{errorText(failed.error, tr('home.loadFailed'))}</Text>
            <Button label={tr('common:actions.retry')} size="sm" variant="soft" onPress={refetchAll} style={styles.errorBtn} />
          </Card>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip label={tr('all')} active={!region} onPress={() => setRegion(undefined)} />
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
            title={tr('home.popularPlaces')}
            actionLabel={tr('common:actions.more')}
            onAction={() => navigation.navigate('Places', region ? { region } : undefined)}
          />
          {places.isLoading ? (
            <Loading />
          ) : !places.data?.data.length ? (
            <EmptyLine>{emptyText('Places')}</EmptyLine>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
              {places.data.data.map((p) => (
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
            title={tr('home.featuredExperiences')}
            actionLabel={tr('common:actions.more')}
            onAction={() => navigation.navigate('Experiences')}
          />
          {experiences.isLoading ? (
            <Loading />
          ) : !experiences.data?.data.length ? (
            <EmptyLine>{emptyText('Experiences')}</EmptyLine>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
              {experiences.data.data.map((e) => (
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
          )}
        </View>

        {/* Otel və qonaq evi paketləri — biznes profili (ekran 22) → otel rezervasiyası (ekran 49) */}
        {lodging.length ? (
          <View style={styles.section}>
            <SectionHead title={tr('home.lodging')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
              {lodging.map((b) => (
                <PhotoCard
                  key={b.slug}
                  uri={b.coverUrl}
                  title={b.name}
                  subtitle={b.region.name}
                  rating={b.ratingCount > 0 ? b.rating : null}
                  badge={
                    b.packageCount > 0
                      ? tpr('home.packages', b.packageCount)
                      : label(BUSINESS_TYPE_LABEL, b.type)
                  }
                  width={220}
                  height={160}
                  accessibilityLabel={tr('home.businessA11y', { name: b.name })}
                  onPress={() => navigation.navigate('BusinessProfile', { slug: b.slug })}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHead
            title={tr('home.recommendedRoutes')}
            actionLabel={tr('common:actions.more')}
            onAction={() => navigation.navigate('Routes')}
          />
          {routes.isLoading ? (
            <Loading />
          ) : !routes.data?.data.length ? (
            <EmptyLine>{emptyText('Routes')}</EmptyLine>
          ) : (
            <View style={styles.list}>
              {routes.data.data.map((r) => (
                <RowCard
                  key={r.slug}
                  uri={r.coverUrl}
                  title={r.title}
                  subtitle={`${tpr('common:labels.duration.days', r.days)} · ${r.region.name}`}
                  meta={
                    <Text variant="small" color="muted">
                      {tpr('units.stops', r.stopCount)}
                      {r.distanceKm ? ` · ${kmLabel(r.distanceKm)}` : ''}
                    </Text>
                  }
                  onPress={() => navigation.navigate('RouteDetail', { slug: r.slug })}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  errorCard: { marginHorizontal: t.spacing.page, marginBottom: t.spacing.md },
  errorBtn: { marginTop: t.spacing.sm, alignSelf: 'flex-start' },
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
  emptyLine: { paddingVertical: t.spacing.sm },
});
