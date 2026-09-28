import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, EmptyState, ExperienceCard, ListSkeleton, Screen, TopBar } from '@/components';
import { useCategoryList, useExperiences } from '@/api/hooks/content';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 16 — təcrübələr. */
export function ExperiencesScreen({ navigation }: AppScreenProps<'Experiences'>) {
  const { t: tr } = useT('explore');
  const [category, setCategory] = useState<string | undefined>();
  const categories = useCategoryList('experience');
  const experiences = useExperiences({ categories: category, limit: 30 });

  return (
    <Screen padded={false}>
      <TopBar title={tr('experiences.title')} onBack={navigation.goBack} />

      <View style={styles.chipRow}>
        <Chip label={tr('all')} active={!category} onPress={() => setCategory(undefined)} />
        {(categories.data ?? []).map((c) => (
          <Chip
            key={c.slug}
            label={c.name}
            active={category === c.slug}
            onPress={() => setCategory(c.slug)}
          />
        ))}
      </View>

      <View style={styles.body}>
        {experiences.isLoading ? (
          <ListSkeleton />
        ) : !experiences.data?.data.length ? (
          <EmptyState title={tr('experiences.emptyTitle')} message={tr('experiences.emptyMessage')} />
        ) : (
          <View style={styles.grid}>
            {experiences.data.data.map((e) => (
              <ExperienceCard
                key={e.slug}
                uri={e.coverUrl}
                title={e.title}
                subtitle={e.region.name}
                priceAzn={e.priceAzn}
                rating={e.rating || undefined}
                ratingCount={e.ratingCount || undefined}
                width="47.5%"
                onPress={() => navigation.navigate('ExperienceDetail', { slug: e.slug })}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md },
});
