import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, EmptyState, Loading, Rating, RowCard, Screen, Text, TopBar } from '@/components';
import { useSaved } from '@/api/hooks/details';
import { SEARCH_TYPE_LABEL, label } from '@/lib/labels';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

const FILTERS = [
  { key: undefined, label: 'Hamısı', countKey: 'all' },
  { key: 'place', label: 'Yerlər', countKey: 'place' },
  { key: 'route', label: 'Marşrutlar', countKey: 'route' },
  { key: 'experience', label: 'Təcrübələr', countKey: 'experience' },
  { key: 'event', label: 'Tədbirlər', countKey: 'event' },
] as const;

/** Ekran 33 — Want to go. */
export function SavedScreen({ navigation }: AppScreenProps<'Saved'>) {
  const [type, setType] = useState<string | undefined>();
  const saved = useSaved(type);

  const open = (itemType: string, slug: string) => {
    if (itemType === 'place') navigation.navigate('PlaceDetail', { slug });
    else if (itemType === 'route') navigation.navigate('RouteDetail', { slug });
    else if (itemType === 'experience') navigation.navigate('ExperienceDetail', { slug });
  };

  return (
    <Screen padded={false}>
      <TopBar title="Want to go" onBack={navigation.goBack} />

      <View style={styles.chips}>
        {FILTERS.map((f) => {
          const count = saved.data?.counts[f.countKey] ?? 0;
          return (
            <Chip
              key={f.label}
              label={count ? `${f.label} · ${count}` : f.label}
              active={type === f.key}
              onPress={() => setType(f.key)}
            />
          );
        })}
      </View>

      <View style={styles.body}>
        {saved.isLoading ? (
          <Loading />
        ) : !saved.data?.data.length ? (
          <EmptyState
            title="Siyahın boşdur"
            message="Bəyəndiyin məkanı, marşrutu və ya təcrübəni saxla — sonra buradan tapacaqsan."
          />
        ) : (
          <View style={styles.list}>
            {saved.data.data.map((item) => (
              <RowCard
                key={item.savedId}
                uri={item.imageUrl}
                title={item.title}
                subtitle={item.subtitle}
                meta={
                  <View style={styles.meta}>
                    <Text variant="caption" color="green900" style={styles.tag}>
                      {label(SEARCH_TYPE_LABEL, item.type)}
                    </Text>
                    {item.rating ? <Rating value={item.rating} /> : null}
                    {item.priceAzn ? <Text variant="caption">{item.priceAzn} AZN</Text> : null}
                  </View>
                }
                onPress={() => open(item.type, item.slug)}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm,
    paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.lg,
  },
  body: { paddingHorizontal: t.spacing.page },
  list: { gap: t.spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  tag: {
    backgroundColor: t.colors.green100, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: t.radius.pill, overflow: 'hidden', fontWeight: '600',
  },
});
