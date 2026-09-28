import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, EmptyState, Icon, Input, Loading, RowCard, Screen, Text, TopBar } from '@/components';
import { useSearch, type SearchHit } from '@/api/hooks/content';
import { SEARCH_TYPE_LABEL, label, kmLabel } from '@/lib/labels';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Çip mətni render zamanı tərcümə olunur — burada yalnız açarlar. */
const TYPES = [
  { key: undefined, labelKey: 'all' },
  { key: 'place', labelKey: 'search.types.place' },
  { key: 'route', labelKey: 'search.types.route' },
  { key: 'experience', labelKey: 'search.types.experience' },
  { key: 'user', labelKey: 'search.types.user' },
] as const;

/** Ekran 11 — axtarış. */
export function SearchScreen({ navigation }: AppScreenProps<'Search'>) {
  const { t: tr, tp: tpr } = useT('explore');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string | undefined>();
  const search = useSearch(query, type ? { types: type } : {});

  const open = (hit: SearchHit) => {
    if (hit.type === 'place') navigation.navigate('PlaceDetail', { slug: hit.slug });
    else if (hit.type === 'route') navigation.navigate('RouteDetail', { slug: hit.slug });
    else if (hit.type === 'experience') navigation.navigate('ExperienceDetail', { slug: hit.slug });
    else if (hit.type === 'user') navigation.navigate('UserProfile', { username: hit.slug });
  };

  return (
    <Screen padded={false}>
      <TopBar title={tr('search.title')} onBack={navigation.goBack} />

      <View style={styles.searchWrap}>
        <Input
          icon="search"
          placeholder={tr('search.placeholder')}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <View style={styles.chips}>
        {TYPES.map((ty) => (
          <Chip
            key={ty.labelKey}
            label={tr(ty.labelKey)}
            active={type === ty.key}
            onPress={() => setType(ty.key)}
          />
        ))}
      </View>

      <View style={styles.body}>
        {query.trim().length < 2 ? (
          <EmptyState title={tr('search.promptTitle')} message={tr('search.promptMessage')} />
        ) : search.isLoading ? (
          <Loading />
        ) : !search.data?.results.length ? (
          <EmptyState title={tr('search.emptyTitle')} message={tr('search.emptyMessage', { query })} />
        ) : (
          <>
            <Text variant="meta" style={styles.count}>
              {tpr('search.results', search.data.total)}
            </Text>
            <View style={styles.list}>
              {search.data.results.map((hit) => (
                <RowCard
                  key={`${hit.type}-${hit.slug}`}
                  uri={hit.imageUrl}
                  title={hit.title}
                  subtitle={hit.subtitle}
                  meta={
                    <View style={styles.meta}>
                      <Text variant="caption" color="green900" style={styles.typeTag}>
                        {label(SEARCH_TYPE_LABEL, hit.type)}
                      </Text>
                      {hit.rating ? (
                        <View style={styles.metaItem}>
                          <Icon name="star" size={12} color={t.colors.star} filled />
                          <Text variant="caption">{hit.rating.toFixed(1)}</Text>
                        </View>
                      ) : null}
                      {hit.priceAzn ? <Text variant="caption">{hit.priceAzn} AZN</Text> : null}
                      {hit.distanceKm != null ? <Text variant="caption">{kmLabel(hit.distanceKm)}</Text> : null}
                    </View>
                  }
                  onPress={() => open(hit)}
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
  searchWrap: { paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, paddingHorizontal: t.spacing.page },
  body: { paddingHorizontal: t.spacing.page, paddingTop: t.spacing.lg },
  count: { marginBottom: t.spacing.md },
  list: { gap: t.spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  typeTag: {
    backgroundColor: t.colors.green100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: t.radius.pill,
    overflow: 'hidden',
    fontWeight: '600',
  },
});
